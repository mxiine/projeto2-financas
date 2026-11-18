// Regras de negócio puras (sem acesso ao banco): datas, parcelamento e faturas de cartão.
// Ficam em models/ conforme o enunciado (seção 10.9). Datas sempre em 'AAAA-MM-DD' / UTC.

export function ultimoDiaDoMes(ano, mes) { // mes: 0 a 11
  return new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
}

// Aceita mes fora de 0..11 (ex.: 12 = janeiro do ano seguinte) e ajusta dia 31 em meses curtos
export function dataSegura(ano, mes, dia) {
  const a = ano + Math.floor(mes / 12);
  const m = ((mes % 12) + 12) % 12;
  return new Date(Date.UTC(a, m, Math.min(dia, ultimoDiaDoMes(a, m))));
}

export const paraISO = (d) => d.toISOString().slice(0, 10);

export function hojeISO() {
  const h = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${h.getFullYear()}-${p(h.getMonth() + 1)}-${p(h.getDate())}`;
}

export function dataValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && paraISO(d) === valor;
}

export function somarDias(iso, dias) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return paraISO(d);
}

export function diferencaDias(inicio, fim) {
  return Math.round((new Date(`${fim}T00:00:00Z`) - new Date(`${inicio}T00:00:00Z`)) / 86400000);
}

export function somarMeses(iso, meses) { // 'AAAA-MM-DD' → mesmo dia (ajustado) N meses depois
  const [a, m, d] = iso.split('-').map(Number);
  return paraISO(dataSegura(a, m - 1 + meses, d));
}

export function primeiroDiaDoMes(iso, deslocamento = 0) {
  const [a, m] = iso.split('-').map(Number);
  return paraISO(dataSegura(a, m - 1 + deslocamento, 1));
}

export function ultimoDiaISO(iso, deslocamento = 0) {
  const [a, m] = iso.split('-').map(Number);
  const base = dataSegura(a, m - 1 + deslocamento, 1);
  return paraISO(dataSegura(base.getUTCFullYear(), base.getUTCMonth(), 31));
}

// Divide o valor em centavos; a diferença de arredondamento vai para a 1ª parcela.
// R$ 100,00 em 3x → [34,00 ... 33,34 + 33,33 + 33,33] (retorna em reais, 2 casas)
export function dividirParcelas(valor, totalParcelas) {
  const totalCentavos = Math.round(valor * 100);
  const base = Math.floor(totalCentavos / totalParcelas);
  const resto = totalCentavos - base * totalParcelas;
  return Array.from({ length: totalParcelas }, (_, i) => (i === 0 ? base + resto : base) / 100);
}

// dataCompra: 'AAAA-MM-DD'; cartao: { diaFechamento, diaVencimento }
// Compra antes do dia de fechamento → fatura que fecha neste mês; no dia ou depois → mês seguinte.
export function calcularFatura(dataCompra, cartao, numeroParcela = 1) {
  const [ano, mes, dia] = dataCompra.split('-').map(Number);
  const m = mes - 1;
  const fechamentoDoMes = Math.min(cartao.diaFechamento, ultimoDiaDoMes(ano, m));

  let mesFechamento = dia < fechamentoDoMes ? m : m + 1;
  mesFechamento += numeroParcela - 1;

  const fechamento = dataSegura(ano, mesFechamento, cartao.diaFechamento);
  const mesVencimento = cartao.diaVencimento > cartao.diaFechamento ? mesFechamento : mesFechamento + 1;
  const vencimento = dataSegura(ano, mesVencimento, cartao.diaVencimento);

  return {
    referencia: paraISO(vencimento).slice(0, 7),
    fechamento: paraISO(fechamento),
    vencimento: paraISO(vencimento),
  };
}

// Período anterior de mesmo tamanho. Meses fechados (ex.: outubro) comparam com os meses
// anteriores inteiros (setembro); qualquer outro intervalo usa o mesmo número de dias.
export function periodoAnterior(inicio, fim) {
  const mesesCheios = inicio.endsWith('-01') && fim === ultimoDiaISO(fim);
  if (mesesCheios) {
    const [a1, m1] = inicio.split('-').map(Number);
    const [a2, m2] = fim.split('-').map(Number);
    const qtd = (a2 - a1) * 12 + (m2 - m1) + 1;
    return { inicio: primeiroDiaDoMes(inicio, -qtd), fim: ultimoDiaISO(inicio, -1) };
  }
  const dias = diferencaDias(inicio, fim) + 1;
  const fimAnterior = somarDias(inicio, -1);
  return { inicio: somarDias(fimAnterior, -(dias - 1)), fim: fimAnterior };
}
