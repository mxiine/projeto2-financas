import express from 'express';
import { autenticar } from '../middlewares/autenticar.js';
import { dadosSaudeFinanceira } from '../models/relatorio.model.js';
import { analisarSaude } from '../models/saudeFinanceira.model.js';

const router = express.Router();
router.use(autenticar);

// GET /api/saude-financeira — indicadores, projeção e dicas calculados no servidor (por regras)
router.get('/', async (req, res, next) => {
  try {
    const dados = await dadosSaudeFinanceira(req.usuarioId);
    return res.status(200).json(analisarSaude(dados));
  } catch (erro) { return next(erro); }
});

export default router;
