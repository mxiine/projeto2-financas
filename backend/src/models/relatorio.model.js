import { pool } from '../config/database.js';
import {
  calcularFatura, hojeISO, periodoAnterior, paraISO, dataSegura,
} from './regrasCartao.js';

const arred = (n) => Math.round(n * 100) / 100;

// ---------- RF7: relatório por categoria ----------

async function totaisPorCategoria(usuarioId, tipo, inicio, fim) {
  const [rows] = await pool.execute(
    `SELECT c.id, c.nome, SUM(l.valor) AS total
       FROM lancamentos l
       JOIN categorias c ON c.id = l.categoria_id AND c.usuario_id = l.usuario_id
      WHERE l.usuario_id = ? AND l.tipo = ? AND l.data BETWEEN ? AND ?
      GROUP BY c.id, c.nome
      ORDER BY total DESC`,
    [usuarioId, tipo, inicio, fim]
  );
  return rows.map((r) => ({ id: r.id, nome: r.nome, total: Number(r.total) }));
}

function combinar(atuais, anteriores) {
  const total = atuais.reduce((s, c) => s + c.total, 0);
  const mapa = new Map();
  for (const c of atuais) mapa.set(c.id, { ...c, periodoAnterior: 0 });
  for (const c of anteriores) {
    if (mapa.has(c.id)) mapa.get(c.id).periodoAnterior = c.total;
    else mapa.set(c.id, { id: c.id, nome: c.nome, total: 0, periodoAnterior: c.total });
  }
  const lista = [...mapa.values()].map((c) => {
    const variacao = arred(c.total - c.periodoAnterior);
    return {
      ...c,
      total: arred(c.total),
      periodoAnterior: arred(c.periodoAnterior),
      percentual: total > 0 ? arred((c.total / total) * 100) : 0,
      variacao,
      variacaoPercentual: c.periodoAnterior > 0 ? arred((variacao / c.periodoAnterior) * 100) : null,
      tendencia: variacao > 0 ? 'aumento' : variacao < 0 ? 'reducao' : 'estavel',
    };
  });
  lista.sort((a, b) => b.total - a.total || b.periodoAnterior - a.periodoAnterior);
  return { total: arred(total), lista };
}

export async function relatorioPorCategoria(usuarioId, inicio, fim) {
  const anterior = periodoAnterior(inicio, fim);
  const [saidas, saidasAnt, entradas, entradasAnt] = await Promise.all([
    totaisPorCategoria(usuarioId, 'saida', inicio, fim),
    totaisPorCategoria(usuarioId, 'saida', anterior.inicio, anterior.fim),
    totaisPorCategoria(usuarioId, 'entrada', inicio, fim),
    totaisPorCategoria(usuarioId, 'entrada', anterior.inicio, anterior.fim),
  ]);
  const s = combinar(saidas, saidasAnt);
  const e = combinar(entradas, entradasAnt);
  return {
    periodo: { inicio, fim },
    periodoAnterior: anterior,
    totalSaidas: s.total,
    totalEntradas: e.total,
    categorias: s.lista, // saídas por categoria (formato do enunciado)
    entradas: e.lista,
  };
}

// ---------- RF8: relatório por fonte/destino ----------

export async function relatorioPorFonteDestino(usuarioId, inicio, fim) {
  const [rows] = await pool.execute(
    `SELECT fd.id, fd.nome, fd.tipo,
            COALESCE(SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor END), 0) AS entradas,
            COALESCE(SUM(CASE WHEN l.tipo = 'saida' THEN l.valor END), 0) AS saidas
       FROM fontes_destinos fd
       LEFT JOIN lancamentos l
              ON l.fonte_destino_id = fd.id AND l.usuario_id = fd.usuario_id
             AND l.data BETWEEN ? AND ?
      WHERE fd.usuario_id = ?
      GROUP BY fd.id, fd.nome, fd.tipo
      ORDER BY fd.nome`,
    [inicio, fim, usuarioId]
  );
  const itens = rows.map((r) => ({
    id: r.id, nome: r.nome, tipo: r.tipo,
    entradas: arred(Number(r.entradas)), saidas: arred(Number(r.saidas)),
  }));

  return {
    periodo: { inicio, fim },
    entradasPorFonte: itens.filter((i) => i.entradas > 0).map(({ id, nome, tipo, entradas }) => ({ id, nome, tipo, total: entradas }))
      .sort((a, b) => b.total - a.total),
    saidasPorDestino: itens.filter((i) => i.saidas > 0).map(({ id, nome, tipo, saidas }) => ({ id, nome, tipo, total: saidas }))
      .sort((a, b) => b.total - a.total),
    saldoContas: itens.filter((i) => i.tipo === 'conta')
      .map((i) => ({ id: i.id, nome: i.nome, entradas: i.entradas, saidas: i.saidas, saldo: arred(i.entradas - i.saidas) })),
    totalEntradas: arred(itens.reduce((s, i) => s + i.entradas, 0)),
    totalSaidas: arred(itens.reduce((s, i) => s + i.saidas, 0)),
  };
}

// ---------- RF9: faturas de cartão de crédito ----------

export async function listarCartoes(usuarioId) {
  const [rows] = await pool.execute(
    `SELECT id, nome, dia_fechamento AS diaFechamento, dia_vencimento AS diaVencimento, limite
       FROM fontes_destinos WHERE usuario_id = ? AND tipo = 'cartao_credito' ORDER BY nome`,
    [usuarioId]
  );
  return rows.map((r) => ({ ...r, limite: Number(r.limite) }));
}

// Todas as parcelas (lançamentos de saída) de cada cartão, com a fatura em que cada uma cai
export async function parcelasDosCartoes(usuarioId, cartoes) {
  if (!cartoes.length) return new Map();
  const [rows] = await pool.execute(
    `SELECT l.id, l.fonte_destino_id AS cartaoId, l.descricao, l.valor,
            DATE_FORMAT(l.data, '%Y-%m-%d') AS data,
            l.parcela_atual AS parcelaAtual, l.total_parcelas AS totalParcelas,
            c.nome AS categoria, l.categoria_id AS categoriaId
       FROM lancamentos l
       JOIN categorias c ON c.id = l.categoria_id
       JOIN fontes_destinos fd ON fd.id = l.fonte_destino_id
      WHERE l.usuario_id = ? AND l.tipo = 'saida' AND fd.tipo = 'cartao_credito'
      ORDER BY l.data, l.id`,
    [usuarioId]
  );
  const porCartao = new Map(cartoes.map((c) => [c.id, []]));
  for (const r of rows) {
    const cartao = cartoes.find((c) => c.id === r.cartaoId);
    if (!cartao) continue;
    porCartao.get(cartao.id).push({
      ...r,
      valor: Number(r.valor),
      fatura: calcularFatura(r.data, cartao, r.parcelaAtual),
    });
  }
  return porCartao;
}

export async function relatorioFaturas(usuarioId, meses = 3) {
  const hoje = hojeISO();
  const cartoes = await listarCartoes(usuarioId);
  const parcelas = await parcelasDosCartoes(usuarioId, cartoes);

  const resultado = cartoes.map((cartao) => {
    const itens = parcelas.get(cartao.id);
    const porRef = new Map();
    for (const p of itens) {
      if (!porRef.has(p.fatura.referencia)) porRef.set(p.fatura.referencia, []);
      porRef.get(p.fatura.referencia).push(p);
    }

    // Ciclos exibidos: a fatura anterior (se ainda não venceu), a aberta e as próximas N
    const ciclos = [];
    const anterior = calcularFatura(hoje, cartao, 0);
    if (anterior.vencimento >= hoje) ciclos.push(anterior);
    for (let k = 1; k <= meses + 1; k++) ciclos.push(calcularFatura(hoje, cartao, k));

    const faturas = ciclos.map((ciclo) => {
      const lancs = porRef.get(ciclo.referencia) ?? [];
      const total = arred(lancs.reduce((s, l) => s + l.valor, 0));
      const status = ciclo.fechamento <= hoje ? 'fechada' : ciclo === ciclos.find((c) => c.fechamento > hoje) ? 'aberta' : 'futura';
      return {
        ...ciclo, status, total,
        lancamentos: lancs.map((l) => ({
          id: l.id, descricao: l.descricao, valor: l.valor, dataCompra: l.data, categoria: l.categoria,
          parcelaAtual: l.parcelaAtual, totalParcelas: l.totalParcelas,
          rotuloParcela: l.totalParcelas > 1 ? `${l.descricao} — ${l.parcelaAtual}/${l.totalParcelas}` : l.descricao,
        })),
      };
    });

    // Limite comprometido = todas as parcelas cuja fatura ainda não venceu
    const utilizado = arred(itens.filter((p) => p.fatura.vencimento >= hoje).reduce((s, p) => s + p.valor, 0));

    return {
      cartao: { id: cartao.id, nome: cartao.nome, diaFechamento: cartao.diaFechamento, diaVencimento: cartao.diaVencimento },
      limite: cartao.limite,
      limiteUtilizado: utilizado,
      limiteDisponivel: arred(cartao.limite - utilizado),
      faturas,
    };
  });

  return { dataReferencia: hoje, meses, cartoes: resultado };
}

// ---------- Desafio: saúde financeira ----------

export const mesDe = (iso) => iso.slice(0, 7);

export async function dadosSaudeFinanceira(usuarioId) {
  const hoje = hojeISO();
  const inicioJanela = paraISO(dataSegura(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)) - 1 - 3, 1)); // 3 meses antes do atual

  const [mensal] = await pool.execute(
    `SELECT DATE_FORMAT(l.data, '%Y-%m') AS mes,
            COALESCE(SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor END), 0) AS entradas,
            COALESCE(SUM(CASE WHEN l.tipo = 'saida' THEN l.valor END), 0) AS saidas,
            COALESCE(SUM(CASE WHEN l.tipo = 'saida' AND fd.tipo = 'cartao_credito' THEN l.valor END), 0) AS cartao
       FROM lancamentos l JOIN fontes_destinos fd ON fd.id = l.fonte_destino_id
      WHERE l.usuario_id = ? AND l.data >= ? AND l.data <= ?
      GROUP BY mes ORDER BY mes`,
    [usuarioId, inicioJanela, hoje]
  );

  const [porCategoria] = await pool.execute(
    `SELECT DATE_FORMAT(l.data, '%Y-%m') AS mes, c.nome, SUM(l.valor) AS total
       FROM lancamentos l JOIN categorias c ON c.id = l.categoria_id
      WHERE l.usuario_id = ? AND l.tipo = 'saida' AND l.data >= ? AND l.data <= ?
      GROUP BY mes, c.nome`,
    [usuarioId, inicioJanela, hoje]
  );

  const [[caixa]] = await pool.execute(
    `SELECT COALESCE(SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor END), 0) AS entradas,
            COALESCE(SUM(CASE WHEN l.tipo = 'saida' AND fd.tipo <> 'cartao_credito' THEN l.valor END), 0) AS saidasAVista
       FROM lancamentos l JOIN fontes_destinos fd ON fd.id = l.fonte_destino_id
      WHERE l.usuario_id = ? AND l.data <= ?`,
    [usuarioId, hoje]
  );

  const faturas = await relatorioFaturas(usuarioId, 6);

  // Faturas de cartão já vencidas (consideradas pagas) saíram do caixa
  const cartoes = await listarCartoes(usuarioId);
  const parcelas = await parcelasDosCartoes(usuarioId, cartoes);
  let cartaoVencido = 0;
  for (const itens of parcelas.values()) {
    for (const p of itens) if (p.fatura.vencimento < hoje) cartaoVencido += p.valor;
  }

  return {
    hoje,
    cartaoVencido: arred(cartaoVencido),
    mensal: mensal.map((m) => ({ mes: m.mes, entradas: Number(m.entradas), saidas: Number(m.saidas), cartao: Number(m.cartao) })),
    porCategoria: porCategoria.map((c) => ({ mes: c.mes, nome: c.nome, total: Number(c.total) })),
    caixa: { entradas: Number(caixa.entradas), saidasAVista: Number(caixa.saidasAVista) },
    faturas,
  };
}
