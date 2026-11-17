import { pool } from '../config/database.js';

export async function listarLancamentosEResumo({ usuarioId, inicio, fim, pagina, porPagina }) {
  const offset = (pagina - 1) * porPagina;

  const [totaisRows] = await pool.execute(
    `SELECT
       COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) AS entradas,
       COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0) AS saidas
     FROM lancamentos
     WHERE usuario_id = ? AND data BETWEEN ? AND ?`,
    [usuarioId, inicio, fim]
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM lancamentos
     WHERE usuario_id = ? AND data BETWEEN ? AND ?`,
    [usuarioId, inicio, fim]
  );

  const [rows] = await pool.execute(
    `SELECT
       l.id,
       l.tipo,
       l.descricao,
       l.valor,
       DATE_FORMAT(l.data, '%Y-%m-%d') AS data,
       l.categoria_id AS categoriaId,
       c.nome AS categoria,
       l.fonte_destino_id AS fonteDestinoId,
       fd.nome AS fonteDestino,
       l.parcela_atual AS parcelaAtual,
       l.total_parcelas AS totalParcelas,
       l.grupo_parcelamento AS grupoParcelamento
     FROM lancamentos l
     INNER JOIN categorias c
       ON c.id = l.categoria_id AND c.usuario_id = l.usuario_id
     INNER JOIN fontes_destinos fd
       ON fd.id = l.fonte_destino_id AND fd.usuario_id = l.usuario_id
     WHERE l.usuario_id = ? AND l.data BETWEEN ? AND ?
     ORDER BY l.data DESC, l.id DESC
     LIMIT ? OFFSET ?`,
    [usuarioId, inicio, fim, porPagina, offset]
  );

  const entradas = Number(totaisRows[0]?.entradas || 0);
  const saidas = Number(totaisRows[0]?.saidas || 0);
  const total = Number(countRows[0]?.total || 0);

  return {
    periodo: { inicio, fim },
    totais: {
      entradas,
      saidas,
      saldo: entradas - saidas,
    },
    lancamentos: rows.map((row) => ({ ...row, valor: Number(row.valor) })),
    paginacao: {
      pagina,
      porPagina,
      total,
      totalPaginas: Math.ceil(total / porPagina),
    },
  };
}


function criarErro(status, mensagem) {
  const erro = new Error(mensagem);
  erro.status = status;
  throw erro;
}

// Evita que uma parcela caia em um dia inexistente.
// Exemplo: 31 de janeiro -> 28 de fevereiro.
function adicionarMeses(dataOriginal, quantidade) {
  const [ano, mes, dia] = dataOriginal.split('-').map(Number);

  const primeiroDia = new Date(
    Date.UTC(ano, mes - 1 + quantidade, 1)
  );

  const ultimoDia = new Date(
    Date.UTC(
      primeiroDia.getUTCFullYear(),
      primeiroDia.getUTCMonth() + 1,
      0
    )
  ).getUTCDate();

  const diaFinal = Math.min(dia, ultimoDia);

  return [
    primeiroDia.getUTCFullYear(),
    String(primeiroDia.getUTCMonth() + 1).padStart(2, '0'),
    String(diaFinal).padStart(2, '0'),
  ].join('-');
}

export async function criarLancamento({
  usuarioId,
  tipo,
  descricao,
  valor,
  data,
  categoriaId,
  fonteDestinoId,
  totalParcelas = 1,
}) {
  // Confere se a categoria pertence ao usuário
  // e se é compatível com o tipo do lançamento.
  const [categorias] = await pool.execute(
    `SELECT id
     FROM categorias
     WHERE id = ? AND usuario_id = ? AND tipo = ?`,
    [categoriaId, usuarioId, tipo]
  );

  if (categorias.length === 0) {
    criarErro(400, 'Categoria inválida ou incompatível com o lançamento.');
  }

  // Entrada utiliza fonte do tipo renda.
  // Saída utiliza destino do tipo conta ou cartao_credito.
  const tiposPermitidos =
    tipo === 'entrada'
      ? ['renda']
      : ['conta', 'cartao_credito'];

  const placeholders = tiposPermitidos.map(() => '?').join(', ');

  const [fontes] = await pool.execute(
    `SELECT id
     FROM fontes_destinos
     WHERE id = ?
       AND usuario_id = ?
       AND tipo IN (${placeholders})`,
    [fonteDestinoId, usuarioId, ...tiposPermitidos]
  );

  if (fontes.length === 0) {
    criarErro(400, 'Fonte ou destino inválido ou incompatível com o lançamento.');
  }

  // Trabalha em centavos para evitar erros de arredondamento.
  const valorEmCentavos = Math.round(valor * 100);
  const valorBase = Math.floor(valorEmCentavos / totalParcelas);
  const resto = valorEmCentavos % totalParcelas;

  const grupoParcelamento =
    totalParcelas > 1
      ? (await import('node:crypto')).randomUUID()
      : null;

  const conexao = await pool.getConnection();

  try {
    await conexao.beginTransaction();

    const lancamentosCriados = [];

    for (let parcela = 1; parcela <= totalParcelas; parcela++) {
      // Distribui os centavos restantes nas primeiras parcelas.
      const valorParcelaEmCentavos =
        valorBase + (parcela <= resto ? 1 : 0);

      const valorParcela = (valorParcelaEmCentavos / 100).toFixed(2);

      const dataParcela = adicionarMeses(data, parcela - 1);

      const [resultado] = await conexao.execute(
        `INSERT INTO lancamentos (
          usuario_id,
          tipo,
          descricao,
          valor,
          data,
          categoria_id,
          fonte_destino_id,
          parcela_atual,
          total_parcelas,
          grupo_parcelamento
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          usuarioId,
          tipo,
          descricao,
          valorParcela,
          dataParcela,
          categoriaId,
          fonteDestinoId,
          parcela,
          totalParcelas,
          grupoParcelamento,
        ]
      );

      lancamentosCriados.push({
        id: resultado.insertId,
        parcelaAtual: parcela,
        totalParcelas,
        valor: Number(valorParcela),
        data: dataParcela,
      });
    }

    await conexao.commit();

    return {
      grupoParcelamento,
      lancamentos: lancamentosCriados,
    };
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}

export async function atualizarLancamento({
  id,
  usuarioId,
  descricao,
  valor,
  data,
  categoriaId,
  fonteDestinoId,
}) {
  // Confere se o lançamento existe e pertence ao usuário.
  const [lancamentos] = await pool.execute(
    `SELECT id, tipo
     FROM lancamentos
     WHERE id = ? AND usuario_id = ?`,
    [id, usuarioId]
  );

  if (lancamentos.length === 0) {
    const erro = new Error('Lançamento não encontrado.');
    erro.status = 404;
    throw erro;
  }

  const tipo = lancamentos[0].tipo;

  // Confere a categoria e seu tipo.
  const [categorias] = await pool.execute(
    `SELECT id
     FROM categorias
     WHERE id = ? AND usuario_id = ? AND tipo = ?`,
    [categoriaId, usuarioId, tipo]
  );

  if (categorias.length === 0) {
    const erro = new Error('Categoria inválida ou incompatível com o lançamento.');
    erro.status = 400;
    throw erro;
  }

  // Confere a fonte/destino.
  const tiposPermitidos =
    tipo === 'entrada'
      ? ['renda']
      : ['conta', 'cartao_credito'];

  const placeholders = tiposPermitidos.map(() => '?').join(', ');

  const [fontes] = await pool.execute(
    `SELECT id
     FROM fontes_destinos
     WHERE id = ?
       AND usuario_id = ?
       AND tipo IN (${placeholders})`,
    [fonteDestinoId, usuarioId, ...tiposPermitidos]
  );

  if (fontes.length === 0) {
    const erro = new Error('Fonte ou destino inválido ou incompatível com o lançamento.');
    erro.status = 400;
    throw erro;
  }

  // Atualiza somente o lançamento informado.
  await pool.execute(
    `UPDATE lancamentos
     SET descricao = ?,
         valor = ?,
         data = ?,
         categoria_id = ?,
         fonte_destino_id = ?
     WHERE id = ? AND usuario_id = ?`,
    [
      descricao,
      valor,
      data,
      categoriaId,
      fonteDestinoId,
      id,
      usuarioId,
    ]
  );

  return {
    id,
    tipo,
    descricao,
    valor,
    data,
    categoriaId,
    fonteDestinoId,
  };
}

export async function excluirLancamento({ id, usuarioId }) {
  // Verifica se o lançamento existe e pertence ao usuário.
  const [rows] = await pool.execute(
    `SELECT id
     FROM lancamentos
     WHERE id = ? AND usuario_id = ?`,
    [id, usuarioId]
  );

  if (rows.length === 0) {
    const erro = new Error('Lançamento não encontrado.');
    erro.status = 404;
    throw erro;
  }

  // Exclui somente o lançamento selecionado.
  await pool.execute(
    `DELETE FROM lancamentos
     WHERE id = ? AND usuario_id = ?`,
    [id, usuarioId]
  );

  return { id };
}
