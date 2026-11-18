import express from 'express';
import { autenticar } from '../middlewares/autenticar.js';
import { ErroHttp } from '../middlewares/tratarErros.js';
import { dataValida, primeiroDiaDoMes, ultimoDiaISO, hojeISO } from '../models/regrasCartao.js';
import { relatorioPorCategoria, relatorioPorFonteDestino, relatorioFaturas } from '../models/relatorio.model.js';

const router = express.Router();
router.use(autenticar);

// Período padrão: mês corrente. Valida inicio/fim e lança 400 no padrão { erro, campos }.
function lerPeriodo(query) {
  const hoje = hojeISO();
  const inicio = query.inicio || primeiroDiaDoMes(hoje);
  const fim = query.fim || ultimoDiaISO(hoje);
  const campos = {};
  if (!dataValida(inicio)) campos.inicio = 'Informe uma data válida no formato AAAA-MM-DD.';
  if (!dataValida(fim)) campos.fim = 'Informe uma data válida no formato AAAA-MM-DD.';
  if (!campos.inicio && !campos.fim && inicio > fim) campos.fim = 'A data final deve ser igual ou posterior à inicial.';
  if (Object.keys(campos).length) throw new ErroHttp(400, 'Período inválido.', campos);
  return { inicio, fim };
}

// GET /api/relatorios/categorias?inicio=&fim=
router.get('/categorias', async (req, res, next) => {
  try {
    const { inicio, fim } = lerPeriodo(req.query);
    return res.status(200).json(await relatorioPorCategoria(req.usuarioId, inicio, fim));
  } catch (erro) { return next(erro); }
});

// GET /api/relatorios/fontes-destinos?inicio=&fim=
router.get('/fontes-destinos', async (req, res, next) => {
  try {
    const { inicio, fim } = lerPeriodo(req.query);
    return res.status(200).json(await relatorioPorFonteDestino(req.usuarioId, inicio, fim));
  } catch (erro) { return next(erro); }
});

// GET /api/relatorios/faturas?meses=3
router.get('/faturas', async (req, res, next) => {
  try {
    const meses = Number(req.query.meses ?? 3);
    if (!Number.isInteger(meses) || meses < 1 || meses > 12) {
      throw new ErroHttp(400, 'Parâmetros inválidos.', { meses: 'Informe de 1 a 12 meses.' });
    }
    return res.status(200).json(await relatorioFaturas(req.usuarioId, meses));
  } catch (erro) { return next(erro); }
});

export default router;
