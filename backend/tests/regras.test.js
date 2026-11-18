import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularFatura, dividirParcelas, periodoAnterior } from '../src/models/regrasCartao.js';

const nubank = { diaFechamento: 3, diaVencimento: 10 };
const visa = { diaFechamento: 25, diaVencimento: 5 };

test('compra antes do fechamento cai na fatura do mês', () => {
  assert.deepEqual(calcularFatura('2026-11-02', nubank), { referencia: '2026-11', fechamento: '2026-11-03', vencimento: '2026-11-10' });
});

test('compra no dia do fechamento cai na fatura do mês seguinte', () => {
  assert.equal(calcularFatura('2026-11-03', nubank).referencia, '2026-12');
});

test('vencimento menor que fechamento vai para o mês seguinte', () => {
  assert.deepEqual(calcularFatura('2026-12-28', visa), { referencia: '2027-02', fechamento: '2027-01-25', vencimento: '2027-02-05' });
});

test('parcela k cai k-1 meses depois', () => {
  assert.equal(calcularFatura('2026-12-20', visa, 3).referencia, '2027-03');
});

test('fechamento dia 31 em mês curto é ajustado', () => {
  assert.equal(calcularFatura('2027-02-10', { diaFechamento: 31, diaVencimento: 10 }).fechamento, '2027-02-28');
});

test('R$ 100,00 em 3x soma exatamente R$ 100,00', () => {
  const p = dividirParcelas(100, 3);
  assert.deepEqual(p, [33.34, 33.33, 33.33]);
  assert.equal(p.reduce((s, v) => s + Math.round(v * 100), 0), 10000);
});

test('período anterior: mês cheio compara com o mês anterior', () => {
  assert.deepEqual(periodoAnterior('2026-10-01', '2026-10-31'), { inicio: '2026-09-01', fim: '2026-09-30' });
});
