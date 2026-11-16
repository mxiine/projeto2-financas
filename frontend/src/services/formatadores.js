// Formatação e máscaras (valores em reais, datas pt-BR, CPF).

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatarMoeda = (valor) => moeda.format(Number(valor) || 0);

// 'AAAA-MM-DD' → 'DD/MM/AAAA' (sem passar por Date, para evitar problemas de fuso)
export function formatarData(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export function mascaraCpf(valor) {
  const d = String(valor).replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

// Máscara monetária: digita-se só números e o campo vira "1.234,56".
export function mascaraValor(valor) {
  const centavos = String(valor).replace(/\D/g, '');
  if (!centavos) return '';
  return (Number(centavos) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// "1.234,56" → 1234.56 (número a enviar para a API)
export const valorParaNumero = (texto) =>
  Number(String(texto).replace(/\./g, '').replace(',', '.')) || 0;

// Mês corrente como { inicio, fim } em 'AAAA-MM-DD' (período padrão da listagem)
export function mesCorrente(hoje = new Date()) {
  const a = hoje.getFullYear();
  const m = hoje.getMonth();
  const pad = (n) => String(n).padStart(2, '0');
  const ultimo = new Date(a, m + 1, 0).getDate();
  return { inicio: `${a}-${pad(m + 1)}-01`, fim: `${a}-${pad(m + 1)}-${pad(ultimo)}` };
}
