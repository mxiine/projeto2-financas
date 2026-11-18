import express from 'express';

import { autenticar } from '../middlewares/autenticar.js';

import {
    listarFontesDestinos,
    buscarFonteDestino,
    criarFonteDestino,
    atualizarFonteDestino,
    excluirFonteDestino,
    possuiLancamentos
} from '../models/fonteDestino.model.js';

const router = express.Router();

router.use(autenticar);

const TIPOS_VALIDOS = [
    'renda',
    'conta',
    'cartao_credito'
];

// Validar e normalizar os dados recebidos
function validarFonteDestino(body) {
    const { nome, tipo } = body || {};

    const campos = {};

    const nomeNormalizado =
        typeof nome === 'string' ? nome.trim() : '';

    if (!nomeNormalizado || nomeNormalizado.length > 60) {
        campos.nome = 'Informe um nome com até 60 caracteres.';
    }

    if (!TIPOS_VALIDOS.includes(tipo)) {
        campos.tipo = 'Tipo de fonte/destino inválido.';
    }

    let diaFechamento = null;
    let diaVencimento = null;
    let limite = null;

    if (tipo === 'cartao_credito') {
        diaFechamento = Number(body.diaFechamento);
        diaVencimento = Number(body.diaVencimento);
        limite = Number(body.limite);

        if (
            body.diaFechamento === undefined ||
            body.diaFechamento === null ||
            body.diaFechamento === '' ||
            !Number.isInteger(diaFechamento) ||
            diaFechamento < 1 ||
            diaFechamento > 31
        ) {
            campos.diaFechamento =
                'O dia de fechamento deve estar entre 1 e 31.';
        }

        if (
            body.diaVencimento === undefined ||
            body.diaVencimento === null ||
            body.diaVencimento === '' ||
            !Number.isInteger(diaVencimento) ||
            diaVencimento < 1 ||
            diaVencimento > 31
        ) {
            campos.diaVencimento =
                'O dia de vencimento deve estar entre 1 e 31.';
        }

        if (
            body.limite === undefined ||
            body.limite === null ||
            body.limite === '' ||
            !Number.isFinite(limite) ||
            limite <= 0
        ) {
            campos.limite = 'Informe um limite maior que zero.';
        }
    }

    if (Object.keys(campos).length > 0) {
        return { erro: campos };
    }

    return {
        dados: {
            nome: nomeNormalizado,
            tipo,
            diaFechamento,
            diaVencimento,
            limite
        }
    };
}

// GET /api/fontes-destinos
router.get('/', async (req, res) => {
    try {
        const fontes = await listarFontesDestinos(req.usuarioId);

        return res.status(200).json({
            fontesDestinos: fontes
        });
    } catch (erro) {
        console.error('Erro ao listar fontes/destinos:', erro);

        return res.status(500).json({
            erro: 'Erro ao consultar fontes e destinos.'
        });
    }
});

// POST /api/fontes-destinos
router.post('/', async (req, res) => {
    const validacao = validarFonteDestino(req.body);

    if (validacao.erro) {
        return res.status(400).json({
            erro: 'Dados inválidos.',
            campos: validacao.erro
        });
    }

    try {
        const fonte = await criarFonteDestino({
            usuarioId: req.usuarioId,
            ...validacao.dados
        });

        return res.status(201).json({
            mensagem: 'Fonte/destino cadastrado com sucesso.',
            fonteDestino: fonte
        });
    } catch (erro) {
        if (erro.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                erro: 'Já existe uma fonte/destino com esse nome.'
            });
        }

        console.error('Erro ao cadastrar fonte/destino:', erro);

        return res.status(500).json({
            erro: 'Erro ao cadastrar fonte/destino.'
        });
    }
});

// PUT /api/fontes-destinos/:id
router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            erro: 'Identificador inválido.'
        });
    }

    const validacao = validarFonteDestino(req.body);

    if (validacao.erro) {
        return res.status(400).json({
            erro: 'Dados inválidos.',
            campos: validacao.erro
        });
    }

    try {
        const existente = await buscarFonteDestino(id, req.usuarioId);

        if (!existente) {
            return res.status(404).json({
                erro: 'Fonte/destino não encontrado.'
            });
        }

        const fonte = await atualizarFonteDestino(
            id,
            req.usuarioId,
            validacao.dados
        );

        return res.status(200).json({
            mensagem: 'Fonte/destino atualizado com sucesso.',
            fonteDestino: fonte
        });
    } catch (erro) {
        if (erro.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                erro: 'Já existe uma fonte/destino com esse nome.'
            });
        }

        console.error('Erro ao atualizar fonte/destino:', erro);

        return res.status(500).json({
            erro: 'Erro ao atualizar fonte/destino.'
        });
    }
});

// DELETE /api/fontes-destinos/:id
router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            erro: 'Identificador inválido.'
        });
    }

    try {
        const existente = await buscarFonteDestino(id, req.usuarioId);

        if (!existente) {
            return res.status(404).json({
                erro: 'Fonte/destino não encontrado.'
            });
        }

        const possuiRegistros = await possuiLancamentos(
            id,
            req.usuarioId
        );

        if (possuiRegistros) {
            return res.status(409).json({
                erro: 'Não é possível excluir esta fonte/destino porque existem lançamentos associados.'
            });
        }

        const excluido = await excluirFonteDestino(
            id,
            req.usuarioId
        );

        if (!excluido) {
            return res.status(404).json({
                erro: 'Fonte/destino não encontrado.'
            });
        }

        return res.status(204).send();

    } catch (erro) {
        if (erro.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({
                erro: 'Não é possível excluir esta fonte/destino porque existem lançamentos associados.'
            });
        }

        console.error('Erro ao excluir fonte/destino:', erro);

        return res.status(500).json({
            erro: 'Erro ao excluir fonte/destino.'
        });
    }
});

export default router;
