import express from 'express';
import { autenticar } from '../middlewares/autenticar.js';
import {
  listarCategorias, buscarCategoria, criarCategoria, atualizarCategoria,
  possuiLancamentosCategoria, excluirCategoria,
} from '../models/categoria.model.js';

const router = express.Router();
router.use(autenticar);
const TIPOS_VALIDOS = ['entrada', 'saida'];

function validarCategoria(body) {
  const campos = {};
  const nome = typeof body?.nome === 'string' ? body.nome.trim() : '';
  const tipo = body?.tipo;
  if (!nome || nome.length > 60) campos.nome = 'Informe um nome com até 60 caracteres.';
  if (!TIPOS_VALIDOS.includes(tipo)) campos.tipo = 'O tipo deve ser entrada ou saida.';
  return Object.keys(campos).length ? { campos } : { dados: { nome, tipo } };
}

function idValido(valor) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/categorias
router.get('/', async (req, res, next) => {
  try {
    return res.status(200).json({ categorias: await listarCategorias(req.usuarioId) });
  } catch (erro) { return next(erro); }
});

// POST /api/categorias
router.post('/', async (req, res, next) => {
  const validacao = validarCategoria(req.body);
  if (validacao.campos) return res.status(400).json({ erro: 'Dados inválidos.', campos: validacao.campos });
  try {
    const categoria = await criarCategoria({ usuarioId: req.usuarioId, ...validacao.dados });
    return res.status(201).json({ mensagem: 'Categoria cadastrada com sucesso.', categoria });
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Já existe uma categoria com esse nome e tipo.' });
    return next(erro);
  }
});

// PUT /api/categorias/:id
router.put('/:id', async (req, res, next) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ erro: 'Identificador inválido.' });
  const validacao = validarCategoria(req.body);
  if (validacao.campos) return res.status(400).json({ erro: 'Dados inválidos.', campos: validacao.campos });
  try {
    if (!await buscarCategoria(id, req.usuarioId)) return res.status(404).json({ erro: 'Categoria não encontrada.' });
    const categoria = await atualizarCategoria(id, req.usuarioId, validacao.dados);
    return res.status(200).json({ mensagem: 'Categoria atualizada com sucesso.', categoria });
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Já existe uma categoria com esse nome e tipo.' });
    return next(erro);
  }
});

// DELETE /api/categorias/:id
router.delete('/:id', async (req, res, next) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ erro: 'Identificador inválido.' });
  try {
    if (!await buscarCategoria(id, req.usuarioId)) return res.status(404).json({ erro: 'Categoria não encontrada.' });
    if (await possuiLancamentosCategoria(id, req.usuarioId)) {
      return res.status(409).json({ erro: 'Não é possível excluir esta categoria porque existem lançamentos associados.' });
    }
    await excluirCategoria(id, req.usuarioId);
    return res.status(204).send();
  } catch (erro) {
    if (erro.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ erro: 'Não é possível excluir esta categoria porque existem lançamentos associados.' });
    return next(erro);
  }
});

export default router;
