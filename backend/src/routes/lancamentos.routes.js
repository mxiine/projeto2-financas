import express from 'express';
import { autenticar } from '../middlewares/autenticar.js';
import { ErroHttp } from '../middlewares/tratarErros.js';
import {
  listarLancamentosEResumo, buscarLancamento, criarLancamento,
  atualizarLancamento, excluirLancamento,
} from '../models/lancamento.model.js';
import { dataValida, primeiroDiaDoMes, ultimoDiaISO, hojeISO } from '../models/regrasCartao.js';

const router = express.Router();
router.use(autenticar);

const inteiroPositivo = (v) => {
  const n = Number(v);
  return v !== '' && v !== null && v !== undefined && Number.isInteger(n) && n > 0 ? n : null;
};

// Valida o corpo de POST/PUT; devolve { dados } ou lança 400 no padrão { erro, campos }
function validarCorpo(body, { permiteParcelas }) {
  const b = body || {};
  const campos = {};

  if (!['entrada', 'saida'].includes(b.tipo)) campos.tipo = 'O tipo deve ser entrada ou saida.';

  const descricao = typeof b.descricao === 'string' ? b.descricao.trim() : '';
  if (!descricao || descricao.length > 120) campos.descricao = 'A descrição deve ter entre 1 e 120 caracteres.';

  const valor = typeof b.valor === 'string' ? Number(b.valor.replace(',', '.')) : Number(b.valor);
  if (b.valor === '' || b.valor === null || b.valor === undefined || !Number.isFinite(valor) || valor <= 0 || valor > 9999999999.99) {
    campos.valor = 'O valor deve ser maior que zero.';
  }

  if (!dataValida(b.data)) campos.data = 'Informe uma data válida (AAAA-MM-DD).';

  const categoriaId = inteiroPositivo(b.categoriaId);
  if (!categoriaId) campos.categoriaId = 'Selecione uma categoria.';
  const fonteDestinoId = inteiroPositivo(b.fonteDestinoId);
  if (!fonteDestinoId) campos.fonteDestinoId = 'Selecione a fonte/destino.';

  let totalParcelas = 1;
  if (permiteParcelas && b.totalParcelas !== undefined && b.totalParcelas !== '') {
    totalParcelas = Number(b.totalParcelas);
    if (!Number.isInteger(totalParcelas) || totalParcelas < 1 || totalParcelas > 48) {
      campos.totalParcelas = 'O número de parcelas deve ser de 1 a 48.';
    }
  }

  if (Object.keys(campos).length) throw new ErroHttp(400, 'Dados inválidos.', campos);

  return {
    tipo: b.tipo, descricao, valor: Math.round(valor * 100) / 100,
    data: b.data, categoriaId, fonteDestinoId, totalParcelas,
  };
}

function idDaUrl(req) {
  const id = inteiroPositivo(req.params.id);
  if (!id) throw new ErroHttp(400, 'Identificador inválido.');
  return id;
}

// GET /api/lancamentos?inicio=&fim=&tipo=&categoriaId=&fonteDestinoId=&pagina=&porPagina=
router.get('/', async (req, res, next) => {
  try {
    const hoje = hojeISO();
    const inicio = req.query.inicio || primeiroDiaDoMes(hoje);
    const fim = req.query.fim || ultimoDiaISO(hoje);
    const campos = {};

    if (!dataValida(inicio)) campos.inicio = 'Informe uma data válida no formato AAAA-MM-DD.';
    if (!dataValida(fim)) campos.fim = 'Informe uma data válida no formato AAAA-MM-DD.';
    if (!campos.inicio && !campos.fim && inicio > fim) campos.fim = 'A data final deve ser igual ou posterior à inicial.';

    const tipo = req.query.tipo || undefined;
    if (tipo && !['entrada', 'saida'].includes(tipo)) campos.tipo = 'O tipo deve ser entrada ou saida.';

    let categoriaId, fonteDestinoId;
    if (req.query.categoriaId) {
      categoriaId = inteiroPositivo(req.query.categoriaId);
      if (!categoriaId) campos.categoriaId = 'Categoria inválida.';
    }
    if (req.query.fonteDestinoId) {
      fonteDestinoId = inteiroPositivo(req.query.fonteDestinoId);
      if (!fonteDestinoId) campos.fonteDestinoId = 'Fonte/destino inválido.';
    }

    const pagina = Number(req.query.pagina ?? 1);
    const porPagina = Number(req.query.porPagina ?? 10);
    if (!Number.isInteger(pagina) || pagina < 1) campos.pagina = 'Página inválida.';
    if (!Number.isInteger(porPagina) || porPagina < 1 || porPagina > 100) campos.porPagina = 'Use de 1 a 100 itens por página.';

    if (Object.keys(campos).length) throw new ErroHttp(400, 'Parâmetros inválidos.', campos);

    const resultado = await listarLancamentosEResumo({
      usuarioId: req.usuarioId, inicio, fim, tipo, categoriaId, fonteDestinoId, pagina, porPagina,
    });
    return res.status(200).json(resultado);
  } catch (erro) { return next(erro); }
});

// GET /api/lancamentos/:id
router.get('/:id', async (req, res, next) => {
  try {
    const lancamento = await buscarLancamento(idDaUrl(req), req.usuarioId);
    if (!lancamento) throw new ErroHttp(404, 'Lançamento não encontrado.');
    return res.status(200).json({ lancamento });
  } catch (erro) { return next(erro); }
});

// POST /api/lancamentos (gera N parcelas quando totalParcelas > 1)
router.post('/', async (req, res, next) => {
  try {
    const dados = validarCorpo(req.body, { permiteParcelas: true });
    const { lancamentos } = await criarLancamento({ usuarioId: req.usuarioId, ...dados });
    return res.status(201).json({
      mensagem: lancamentos.length > 1
        ? `Compra parcelada criada em ${lancamentos.length} parcelas.`
        : 'Lançamento criado com sucesso.',
      lancamentos,
    });
  } catch (erro) { return next(erro); }
});

// PUT /api/lancamentos/:id
router.put('/:id', async (req, res, next) => {
  try {
    const id = idDaUrl(req);
    const dados = validarCorpo(req.body, { permiteParcelas: false });
    const lancamento = await atualizarLancamento({ id, usuarioId: req.usuarioId, ...dados });
    return res.status(200).json({ mensagem: 'Lançamento atualizado com sucesso.', lancamento });
  } catch (erro) { return next(erro); }
});

// DELETE /api/lancamentos/:id?todasParcelas=true
router.delete('/:id', async (req, res, next) => {
  try {
    await excluirLancamento({
      id: idDaUrl(req),
      usuarioId: req.usuarioId,
      todasParcelas: req.query.todasParcelas === 'true',
    });
    return res.status(204).send();
  } catch (erro) { return next(erro); }
});

export default router;
