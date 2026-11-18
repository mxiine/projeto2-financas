// Análise da saúde financeira: cálculos a partir dos dados agregados no banco (relatorio.model.js).
// Limites das dicas (documentados no README):
//   poupança: >= 10% ok | 0–10% atenção | < 0 alerta
//   comprometimento com cartões: <= 30% ok | 30–50% atenção | > 50% alerta
//   regra 50/30/20 (necessidades / desejos / poupança) sobre a renda do mês
//   categoria fora da curva: gasto do mês > 20% acima da média dos 3 meses anteriores

const arred = (n) => Math.round(n * 100) / 100;
const media = (lista) => (lista.length ? lista.reduce((s, n) => s + n, 0) / lista.length : 0);
const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n) => `${String(arred(n)).replace('.', ',')}%`;

const NECESSIDADES = new Set(['moradia', 'alimentação', 'alimentacao', 'saúde', 'saude', 'mobilidade', 'educação', 'educacao']);

function mesesAPartir(mesISO, deslocamento) { // 'AAAA-MM' ± N meses
  const [a, m] = mesISO.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + deslocamento, 1));
  return d.toISOString().slice(0, 7);
}

const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const rotuloMes = (mes) => `${NOMES_MES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`;

export function analisarSaude(dados) {
  const atual = dados.hoje.slice(0, 7);
  const anteriores = [-3, -2, -1].map((n) => mesesAPartir(atual, n));
  const porMes = new Map(dados.mensal.map((m) => [m.mes, m]));
  const mes = (k) => porMes.get(k) ?? { mes: k, entradas: 0, saidas: 0, cartao: 0 };
  const dicas = [];

  // 1) Taxa de poupança por mês
  const taxaPoupanca = [...anteriores, atual].map((k) => {
    const { entradas, saidas } = mes(k);
    return { mes: k, entradas: arred(entradas), saidas: arred(saidas), taxa: entradas > 0 ? arred(((entradas - saidas) / entradas) * 100) : null };
  });
  const taxaAtual = taxaPoupanca[taxaPoupanca.length - 1];
  if (taxaAtual.taxa === null) {
    dicas.push({ nivel: 'atencao', indicador: 'poupanca', texto: 'Você ainda não registrou entradas neste mês; sem elas não é possível calcular quanto está guardando.' });
  } else if (taxaAtual.taxa < 0) {
    dicas.push({ nivel: 'alerta', indicador: 'poupanca', texto: `Neste mês você gastou mais do que recebeu (taxa de poupança de ${pct(taxaAtual.taxa)}). Reveja as despesas que podem ser adiadas.` });
  } else if (taxaAtual.taxa < 10) {
    dicas.push({ nivel: 'atencao', indicador: 'poupanca', texto: `Você guardou ${pct(taxaAtual.taxa)} da sua renda neste mês. Uma meta comum é guardar pelo menos 10%.` });
  } else {
    dicas.push({ nivel: 'ok', indicador: 'poupanca', texto: `Você guardou ${pct(taxaAtual.taxa)} da sua renda neste mês, acima da meta usual de 10%.` });
  }

  // Médias dos 3 meses completos
  const completos = anteriores.map(mes);
  let rendaMedia = media(completos.map((m) => m.entradas));
  if (rendaMedia === 0) rendaMedia = mes(atual).entradas;
  const mediaCartao = media(completos.map((m) => m.cartao));
  const mediaAVista = media(completos.map((m) => m.saidas - m.cartao));

  // Faturas (todos os cartões) agrupadas por mês de vencimento
  const faturasPorMes = new Map();
  const parcelasPorMes = new Map();
  for (const c of dados.faturas.cartoes) {
    for (const f of c.faturas) {
      if (f.vencimento < dados.hoje) continue;
      const k = f.referencia;
      faturasPorMes.set(k, (faturasPorMes.get(k) ?? 0) + f.total);
      const soParcelas = f.lancamentos.filter((l) => l.totalParcelas > 1).reduce((s, l) => s + l.valor, 0);
      if (soParcelas > 0) parcelasPorMes.set(k, (parcelasPorMes.get(k) ?? 0) + soParcelas);
    }
  }
  const mesesFatura = [...faturasPorMes.keys()].sort();

  // 2) Comprometimento da renda com as próximas 3 faturas
  const proximas3 = mesesFatura.slice(0, 3);
  const totalProximas = arred(proximas3.reduce((s, k) => s + faturasPorMes.get(k), 0));
  const comprometimento = {
    totalProximasFaturas: totalProximas,
    rendaMediaMensal: arred(rendaMedia),
    percentual: rendaMedia > 0 ? arred((totalProximas / (rendaMedia * Math.max(proximas3.length, 1))) * 100) : null,
    meses: proximas3.length,
  };
  // percentual = média mensal das próximas faturas ÷ renda média mensal
  if (comprometimento.percentual !== null && proximas3.length) {
    const p = comprometimento.percentual;
    const nivel = p > 50 ? 'alerta' : p > 30 ? 'atencao' : 'ok';
    dicas.push({ nivel, indicador: 'cartoes', texto: `Suas faturas dos próximos ${proximas3.length} mês(es) somam ${brl(totalProximas)}, em média ${pct(p)} da sua renda mensal.` });
  }

  // 3) Parcelas futuras por mês
  const parcelasFuturas = [...parcelasPorMes.entries()].sort().map(([k, v]) => ({ mes: k, total: arred(v) }));
  const somaParcelas = arred(parcelasFuturas.reduce((s, p) => s + p.total, 0));
  if (parcelasFuturas.length) {
    const ultimo = parcelasFuturas[parcelasFuturas.length - 1].mes;
    dicas.push({ nivel: 'ok', indicador: 'parcelas', texto: `Você tem ${brl(somaParcelas)} em parcelas a vencer até ${rotuloMes(ultimo)} (considerando as próximas faturas).` });
  }

  // 4) Regra 50/30/20 no mês corrente
  const gastosMes = dados.porCategoria.filter((c) => c.mes === atual);
  const necessidades = gastosMes.filter((c) => NECESSIDADES.has(c.nome.toLowerCase())).reduce((s, c) => s + c.total, 0);
  const desejos = gastosMes.filter((c) => !NECESSIDADES.has(c.nome.toLowerCase())).reduce((s, c) => s + c.total, 0);
  const baseRenda = mes(atual).entradas || rendaMedia;
  let regra503020 = null;
  if (baseRenda > 0) {
    const nec = (necessidades / baseRenda) * 100;
    const des = (desejos / baseRenda) * 100;
    regra503020 = {
      base: arred(baseRenda),
      necessidades: { valor: arred(necessidades), percentual: arred(nec), referencia: 50 },
      desejos: { valor: arred(desejos), percentual: arred(des), referencia: 30 },
      poupanca: { valor: arred(baseRenda - necessidades - desejos), percentual: arred(100 - nec - des), referencia: 20 },
    };
    if (des > 30) dicas.push({ nivel: 'atencao', indicador: 'regra', texto: `Os gastos com desejos estão em ${pct(des)} da renda (referência: 30%).` });
    if (nec > 50) dicas.push({ nivel: 'atencao', indicador: 'regra', texto: `Os gastos com necessidades estão em ${pct(nec)} da renda (referência: 50%).` });
  }

  // 5) Categorias fora da curva (mês atual × média dos 3 meses anteriores)
  const nomes = new Set(gastosMes.map((c) => c.nome));
  const foraDaCurva = [];
  for (const nome of nomes) {
    const valorAtual = gastosMes.find((c) => c.nome === nome).total;
    const mediaCat = media(anteriores.map((k) => dados.porCategoria.find((c) => c.mes === k && c.nome === nome)?.total ?? 0));
    if (mediaCat >= 50 && valorAtual > mediaCat * 1.2) {
      foraDaCurva.push({ categoria: nome, atual: arred(valorAtual), media: arred(mediaCat), percentualAcima: arred(((valorAtual - mediaCat) / mediaCat) * 100) });
    }
  }
  foraDaCurva.sort((a, b) => b.percentualAcima - a.percentualAcima);
  for (const f of foraDaCurva.slice(0, 3)) {
    dicas.push({ nivel: 'atencao', indicador: 'fora_da_curva', texto: `Seus gastos com ${f.categoria} estão ${pct(f.percentualAcima)} acima da média dos 3 meses anteriores.` });
  }

  // 6) Projeção de saldo (próximos 6 meses)
  const saldoInicial = arred(dados.caixa.entradas - dados.caixa.saidasAVista - dados.cartaoVencido);
  let saldo = saldoInicial;
  const projecao = [];
  for (let i = 1; i <= 6; i++) {
    const k = mesesAPartir(atual, i);
    const faturaConhecida = faturasPorMes.get(k) ?? 0;
    const entradas = rendaMedia;
    const saidas = mediaAVista + Math.max(faturaConhecida, mediaCartao);
    saldo = saldo + entradas - saidas;
    projecao.push({ mes: k, entradas: arred(entradas), saidas: arred(saidas), faturaConhecida: arred(faturaConhecida), saldo: arred(saldo) });
  }
  const primeiroNegativo = projecao.find((p) => p.saldo < 0);
  if (primeiroNegativo) {
    dicas.push({ nivel: 'alerta', indicador: 'projecao', texto: `Mantido o padrão dos últimos meses, seu saldo estimado fica negativo em ${rotuloMes(primeiroNegativo.mes)}.` });
  } else if (rendaMedia > 0) {
    dicas.push({ nivel: 'ok', indicador: 'projecao', texto: 'Mantido o padrão dos últimos meses, seu saldo estimado permanece positivo nos próximos 6 meses.' });
  }

  return {
    geradoEm: dados.hoje,
    aviso: 'As informações desta página são educativas e não constituem recomendação financeira profissional.',
    indicadores: { taxaPoupanca, comprometimentoCartoes: comprometimento, parcelasFuturas, regra503020, foraDaCurva },
    projecao: { saldoInicialEstimado: saldoInicial, mediaEntradas: arred(rendaMedia), mediaSaidasAVista: arred(mediaAVista), mediaCartao: arred(mediaCartao), meses: projecao },
    dicas,
  };
}
