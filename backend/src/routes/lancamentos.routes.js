import express from 'express';
import { autenticar } from '../middlewares/autenticar.js';
import {
  listarLancamentosEResumo,
  criarLancamento,
  atualizarLancamento,
  excluirLancamento,
} from '../models/lancamento.model.js';

const router = express.Router();

function dataValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function mesAtual() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ultimoDia = new Date(ano, hoje.getMonth() + 1, 0).getDate();
  return {
    inicio: `${ano}-${mes}-01`,
    fim: `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`,
  };
}

// GET /api/lancamentos?inicio=AAAA-MM-DD&fim=AAAA-MM-DD&pagina=1&porPagina=10
// Nesta primeira etapa, a rota atende a listagem e os totais do Dashboard.
router.get('/', autenticar, async (req, res) => {
  const padrao = mesAtual();
  const inicio = req.query.inicio || padrao.inicio;
  const fim = req.query.fim || padrao.fim;

  if (!dataValida(inicio) || !dataValida(fim) || inicio > fim) {
    return res.status(400).json({
      erro: 'Período inválido.',
      campos: {
        inicio: 'Informe uma data válida no formato AAAA-MM-DD.',
        fim: 'Informe uma data final válida e igual ou posterior à inicial.',
      },
    });
  }

  const pagina = Number.parseInt(req.query.pagina ?? '1', 10);
  const porPagina = Number.parseInt(req.query.porPagina ?? '10', 10);

  if (!Number.isInteger(pagina) || pagina < 1 ||
      !Number.isInteger(porPagina) || porPagina < 1 || porPagina > 100) {
    return res.status(400).json({ erro: 'Parâmetros de paginação inválidos.' });
  }

  try {
    const resultado = await listarLancamentosEResumo({
      usuarioId: req.usuarioId,
      inicio,
      fim,
      pagina,
      porPagina,
    });

    return res.status(200).json(resultado);
  } catch (erro) {
    console.error('Erro ao listar lançamentos:', erro);
    return res.status(500).json({ erro: 'Erro ao consultar lançamentos.' });
  }
});


// POST /api/lancamentos
router.post('/', autenticar, async (req, res) => {
  const {
    tipo,
    descricao,
    valor,
    data,
    categoriaId,
    fonteDestinoId,
    totalParcelas = 1,
  } = req.body;

  const valorNumerico = Number(valor);

  if (!['entrada', 'saida'].includes(tipo)) {
    return res.status(400).json({
      erro: 'Tipo de lançamento inválido.',
    });
  }

  if (
    typeof descricao !== 'string' ||
    descricao.trim().length < 1 ||
    descricao.trim().length > 120
  ) {
    return res.status(400).json({
      erro: 'A descrição deve ter entre 1 e 120 caracteres.',
    });
  }

  if (
    !Number.isFinite(valorNumerico) ||
    valorNumerico <= 0 ||
    valorNumerico > 9999999999.99
  ) {
    return res.status(400).json({
      erro: 'Informe um valor positivo válido.',
    });
  }

  if (
    !dataValida(data) ||
    !Number.isInteger(categoriaId) ||
    categoriaId < 1 ||
    !Number.isInteger(fonteDestinoId) ||
    fonteDestinoId < 1
  ) {
    return res.status(400).json({
      erro: 'Data, categoria ou fonte/destino inválido.',
    });
  }

  if (
    !Number.isInteger(totalParcelas) ||
    totalParcelas < 1 ||
    totalParcelas > 48
  ) {
    return res.status(400).json({
      erro: 'A quantidade de parcelas deve ser entre 1 e 48.',
    });
  }

  try {
    const resultado = await criarLancamento({
      usuarioId: req.usuarioId,
      tipo,
      descricao: descricao.trim(),
      valor: Math.round(valorNumerico * 100) / 100,
      data,
      categoriaId,
      fonteDestinoId,
      totalParcelas,
    });

    return res.status(201).json({
      mensagem: 'Lançamento criado com sucesso.',
      ...resultado,
    });
  } catch (erro) {
    console.error('Erro ao criar lançamento:', erro);

    return res.status(erro.status || 500).json({
      erro: erro.status
        ? erro.message
        : 'Erro ao criar lançamento.',
    });
  }
});

// PUT /api/lancamentos/:id
router.put('/:id', autenticar, async (req, res) => {
  const id = Number(req.params.id);

  const {
    descricao,
    valor,
    data,
    categoriaId,
    fonteDestinoId,
  } = req.body;

  const valorNumerico = Number(valor);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({
      erro: 'ID de lançamento inválido.',
    });
  }

  if (
    typeof descricao !== 'string' ||
    descricao.trim().length < 1 ||
    descricao.trim().length > 120
  ) {
    return res.status(400).json({
      erro: 'A descrição deve ter entre 1 e 120 caracteres.',
    });
  }

  if (
    !Number.isFinite(valorNumerico) ||
    valorNumerico <= 0 ||
    valorNumerico > 9999999999.99
  ) {
    return res.status(400).json({
      erro: 'Informe um valor positivo válido.',
    });
  }

  if (
    !dataValida(data) ||
    !Number.isInteger(categoriaId) ||
    categoriaId < 1 ||
    !Number.isInteger(fonteDestinoId) ||
    fonteDestinoId < 1
  ) {
    return res.status(400).json({
      erro: 'Data, categoria ou fonte/destino inválido.',
    });
  }

  try {
    const resultado = await atualizarLancamento({
      id,
      usuarioId: req.usuarioId,
      descricao: descricao.trim(),
      valor: Math.round(valorNumerico * 100) / 100,
      data,
      categoriaId,
      fonteDestinoId,
    });

    return res.status(200).json({
      mensagem: 'Lançamento atualizado com sucesso.',
      lancamento: resultado,
    });
  } catch (erro) {
    console.error('Erro ao atualizar lançamento:', erro);

    return res.status(erro.status || 500).json({
      erro: erro.status
        ? erro.message
        : 'Erro ao atualizar lançamento.',
    });
  }
});

// DELETE /api/lancamentos/:id
router.delete('/:id', autenticar, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({
      erro: 'ID do lançamento inválido.',
    });
  }

  try {
    const resultado = await excluirLancamento({
      id,
      usuarioId: req.usuarioId,
    });

    return res.status(200).json({
      mensagem: 'Lançamento excluído com sucesso.',
      lancamento: resultado,
    });
  } catch (erro) {
    if (erro.status) {
      return res.status(erro.status).json({
        erro: erro.message,
      });
    }

    console.error('Erro ao excluir lançamento:', erro);

    return res.status(500).json({
      erro: 'Erro ao excluir lançamento.',
    });
  }
});

export default router;
