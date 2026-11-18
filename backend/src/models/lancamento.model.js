import { randomUUID } from 'node:crypto';
import { pool } from '../config/database.js';
import { ErroHttp } from '../middlewares/tratarErros.js';
import { dividirParcelas } from './regrasCartao.js';

const COLUNAS = `
  l.id, l.tipo, l.descricao, l.valor,
  DATE_FORMAT(l.data, '%Y-%m-%d') AS data,
  l.categoria_id AS categoriaId, c.nome AS categoria,
  l.fonte_destino_id AS fonteDestinoId, fd.nome AS fonteDestino,
  l.parcela_atual AS parcelaAtual, l.total_parcelas AS totalParcelas,
  l.grupo_parcelamento AS grupoParcelamento`;

const JUNCOES = `
  FROM lancamentos l
  INNER JOIN categorias c ON c.id = l.categoria_id AND c.usuario_id = l.usuario_id
  INNER JOIN fontes_destinos fd ON fd.id = l.fonte_destino_id AND fd.usuario_id = l.usuario_id`;

const formatar = (row) => ({ ...row, valor: Number(row.valor) });

// Monta o WHERE (sempre filtrando por usuario_id) com os filtros opcionais
function montarFiltro({ usuarioId, inicio, fim, tipo, categoriaId, fonteDestinoId }) {
  const where = ['l.usuario_id = ?', 'l.data BETWEEN ? AND ?'];
  const params = [usuarioId, inicio, fim];
  if (tipo) { where.push('l.tipo = ?'); params.push(tipo); }
  if (categoriaId) { where.push('l.categoria_id = ?'); params.push(categoriaId); }
  if (fonteDestinoId) { where.push('l.fonte_destino_id = ?'); params.push(fonteDestinoId); }
  return { clausula: where.join(' AND '), params };
}

export async function listarLancamentosEResumo({ pagina, porPagina, ...filtros }) {
  const { clausula, params } = montarFiltro(filtros);
  const offset = (pagina - 1) * porPagina;

  const [[totais]] = await pool.execute(
    `SELECT
       COALESCE(SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor ELSE 0 END), 0) AS entradas,
       COALESCE(SUM(CASE WHEN l.tipo = 'saida' THEN l.valor ELSE 0 END), 0) AS saidas,
       COUNT(*) AS total
     FROM lancamentos l WHERE ${clausula}`,
    params
  );

  // pagina/porPagina já validados como inteiros na rota; LIMIT não aceita bem placeholders no MySQL 8
  const [rows] = await pool.execute(
    `SELECT ${COLUNAS} ${JUNCOES}
     WHERE ${clausula}
     ORDER BY l.data DESC, l.id DESC
     LIMIT ${Number(porPagina)} OFFSET ${Number(offset)}`,
    params
  );

  const entradas = Number(totais.entradas);
  const saidas = Number(totais.saidas);
  const total = Number(totais.total);

  return {
    periodo: { inicio: filtros.inicio, fim: filtros.fim },
    totais: { entradas, saidas, saldo: Math.round((entradas - saidas) * 100) / 100 },
    lancamentos: rows.map(formatar),
    paginacao: { pagina, porPagina, total, totalPaginas: Math.ceil(total / porPagina) },
  };
}

export async function buscarLancamento(id, usuarioId, conexao = pool) {
  const [rows] = await conexao.execute(
    `SELECT ${COLUNAS} ${JUNCOES} WHERE l.id = ? AND l.usuario_id = ? LIMIT 1`,
    [id, usuarioId]
  );
  return rows[0] ? formatar(rows[0]) : null;
}

// Garante que categoria e fonte/destino pertencem ao usuário e que os tipos são compatíveis.
async function validarReferencias(conexao, { usuarioId, tipo, categoriaId, fonteDestinoId, totalParcelas }) {
  const [[categoria]] = await conexao.execute(
    'SELECT id, tipo FROM categorias WHERE id = ? AND usuario_id = ?', [categoriaId, usuarioId]
  );
  if (!categoria) {
    throw new ErroHttp(404, 'Categoria não encontrada.', { categoriaId: 'Categoria não encontrada.' });
  }

  const [[fonte]] = await conexao.execute(
    `SELECT id, tipo, dia_fechamento AS diaFechamento, dia_vencimento AS diaVencimento
       FROM fontes_destinos WHERE id = ? AND usuario_id = ?`,
    [fonteDestinoId, usuarioId]
  );
  if (!fonte) {
    throw new ErroHttp(404, 'Fonte/destino não encontrado.', { fonteDestinoId: 'Fonte/destino não encontrado.' });
  }

  const campos = {};
  if (categoria.tipo !== tipo) {
    campos.categoriaId = `A categoria informada é de ${categoria.tipo === 'entrada' ? 'entrada' : 'saída'}, mas o lançamento é de ${tipo === 'entrada' ? 'entrada' : 'saída'}.`;
  }
  if (tipo === 'entrada' && fonte.tipo === 'cartao_credito') {
    campos.fonteDestinoId = 'Uma entrada não pode ter cartão de crédito como fonte.';
  }
  if (tipo === 'saida' && fonte.tipo === 'renda') {
    campos.fonteDestinoId = 'Uma saída não pode ter uma fonte de renda como destino.';
  }
  if (totalParcelas > 1 && (fonte.tipo !== 'cartao_credito' || tipo !== 'saida')) {
    campos.totalParcelas = 'Só é possível parcelar saídas em cartão de crédito.';
  }
  if (Object.keys(campos).length) throw new ErroHttp(400, 'Dados inválidos.', campos);

  return { categoria, fonte };
}

// Cria 1 lançamento ou N parcelas, tudo dentro de uma transação (todas gravadas ou nenhuma).
// Todas as parcelas guardam a data da compra; a fatura é calculada com calcularFatura(data, cartao, parcela).
export async function criarLancamento({ usuarioId, tipo, descricao, valor, data, categoriaId, fonteDestinoId, totalParcelas = 1 }) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();
    await validarReferencias(conexao, { usuarioId, tipo, categoriaId, fonteDestinoId, totalParcelas });

    const grupo = totalParcelas > 1 ? randomUUID() : null;
    const valores = dividirParcelas(valor, totalParcelas);
    const ids = [];

    for (let i = 0; i < totalParcelas; i++) {
      const [r] = await conexao.execute(
        `INSERT INTO lancamentos
           (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id,
            parcela_atual, total_parcelas, grupo_parcelamento)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [usuarioId, tipo, descricao, valores[i].toFixed(2), data, categoriaId, fonteDestinoId, i + 1, totalParcelas, grupo]
      );
      ids.push(r.insertId);
    }

    await conexao.commit();

    const lancamentos = [];
    for (const id of ids) lancamentos.push(await buscarLancamento(id, usuarioId, conexao));
    return { lancamentos };
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}

// Atualiza um único lançamento (uma parcela, se for parcelado). O parcelamento em si não é editável.
export async function atualizarLancamento({ id, usuarioId, tipo, descricao, valor, data, categoriaId, fonteDestinoId }) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [[atual]] = await conexao.execute(
      'SELECT id, total_parcelas AS totalParcelas FROM lancamentos WHERE id = ? AND usuario_id = ? FOR UPDATE',
      [id, usuarioId]
    );
    if (!atual) throw new ErroHttp(404, 'Lançamento não encontrado.');

    await validarReferencias(conexao, {
      usuarioId, tipo, categoriaId, fonteDestinoId,
      totalParcelas: atual.totalParcelas, // parcelado continua exigindo cartão de crédito
    });

    await conexao.execute(
      `UPDATE lancamentos
          SET tipo = ?, descricao = ?, valor = ?, data = ?, categoria_id = ?, fonte_destino_id = ?
        WHERE id = ? AND usuario_id = ?`,
      [tipo, descricao, valor.toFixed(2), data, categoriaId, fonteDestinoId, id, usuarioId]
    );

    await conexao.commit();
    return buscarLancamento(id, usuarioId, conexao);
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}

// Exclui uma parcela/lançamento ou, com todasParcelas, o grupo inteiro. Retorna a quantidade excluída.
export async function excluirLancamento({ id, usuarioId, todasParcelas = false }) {
  const [[atual]] = await pool.execute(
    'SELECT id, grupo_parcelamento AS grupo FROM lancamentos WHERE id = ? AND usuario_id = ?',
    [id, usuarioId]
  );
  if (!atual) throw new ErroHttp(404, 'Lançamento não encontrado.');

  const [r] = todasParcelas && atual.grupo
    ? await pool.execute('DELETE FROM lancamentos WHERE grupo_parcelamento = ? AND usuario_id = ?', [atual.grupo, usuarioId])
    : await pool.execute('DELETE FROM lancamentos WHERE id = ? AND usuario_id = ?', [id, usuarioId]);
  return r.affectedRows;
}
