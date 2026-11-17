import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

import { autenticar } from '../middlewares/autenticar.js';

import {
    buscarPorEmail,
    buscarPorCpf,
    buscarUsuarioPublicoPorId,
    criarUsuarioComDadosPadrao
} from '../models/usuario.model.js';

const router = express.Router();

// Limita tentativas de login
const limitarLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false
});

// Validar CPF com dígitos verificadores
function cpfValido(cpf) {
    const d = String(cpf).replace(/\D/g, '');

    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) {
        return false;
    }

    const calcularDigito = (tamanho) => {
        let soma = 0;

        for (let i = 0; i < tamanho; i++) {
            soma += Number(d[i]) * (tamanho + 1 - i);
        }

        const resto = (soma * 10) % 11;

        return resto === 10 ? 0 : resto;
    };

    return (
        calcularDigito(9) === Number(d[9]) &&
        calcularDigito(10) === Number(d[10])
    );
}

// POST /api/auth/cadastro
router.post('/cadastro', async (req, res, next) => {
    const {
        nome,
        email,
        cpf,
        senha,
        confirmacaoSenha
    } = req.body || {};

    const campos = {};

    const nomeNormalizado =
        typeof nome === 'string' ? nome.trim() : '';

    const emailNormalizado =
        typeof email === 'string'
            ? email.trim().toLowerCase()
            : '';

    const cpfNormalizado =
        typeof cpf === 'string'
            ? cpf.replace(/\D/g, '')
            : '';

    if (!nomeNormalizado || nomeNormalizado.length > 120) {
        campos.nome = 'Informe um nome válido.';
    }

    if (
        !emailNormalizado ||
        emailNormalizado.length > 160 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado)
    ) {
        campos.email = 'Informe um e-mail válido.';
    }

    if (!cpfValido(cpfNormalizado)) {
        campos.cpf = 'Informe um CPF válido.';
    }

    if (
        typeof senha !== 'string' ||
        !/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(senha)
    ) {
        campos.senha =
            'A senha deve ter pelo menos 8 caracteres, contendo letras e números.';
    }

    if (
        typeof confirmacaoSenha !== 'string' ||
        confirmacaoSenha !== senha
    ) {
        campos.confirmacaoSenha = 'As senhas não coincidem.';
    }

    if (Object.keys(campos).length) {
        return res.status(400).json({
            erro: 'Dados inválidos.',
            campos
        });
    }

    try {
        if (await buscarPorEmail(emailNormalizado)) {
            return res.status(409).json({
                erro: 'E-mail já cadastrado.',
                campos: {
                    email: 'Este e-mail já está cadastrado.'
                }
            });
        }

        if (await buscarPorCpf(cpfNormalizado)) {
            return res.status(409).json({
                erro: 'CPF já cadastrado.',
                campos: {
                    cpf: 'Este CPF já está cadastrado.'
                }
            });
        }

        const senhaHash = await bcrypt.hash(senha, 10);

        const usuario = await criarUsuarioComDadosPadrao({
            nome: nomeNormalizado,
            email: emailNormalizado,
            cpf: cpfNormalizado,
            senhaHash
        });

        return res.status(201).json({
            mensagem: 'Cadastro realizado com sucesso!',
            usuario
        });

    } catch (erro) {
        if (erro.code === 'ER_DUP_ENTRY') {
            const mensagem = erro.message.toLowerCase();

            if (mensagem.includes('cpf')) {
                return res.status(409).json({
                    erro: 'CPF já cadastrado.',
                    campos: {
                        cpf: 'Este CPF já está cadastrado.'
                    }
                });
            }

            if (mensagem.includes('email')) {
                return res.status(409).json({
                    erro: 'E-mail já cadastrado.',
                    campos: {
                        email: 'Este e-mail já está cadastrado.'
                    }
                });
            }

            return res.status(409).json({
                erro: 'E-mail ou CPF já cadastrado.'
            });
        }

        next(erro);
    }
});

// POST /api/auth/login
router.post('/login', limitarLogin, async (req, res, next) => {
    const { email, senha } = req.body || {};

    if (
        typeof email !== 'string' ||
        !email.trim() ||
        typeof senha !== 'string' ||
        !senha
    ) {
        return res.status(400).json({
            erro: 'Informe e-mail e senha.'
        });
    }

    try {
        const usuario = await buscarPorEmail(
            email.trim().toLowerCase()
        );

        if (
            !usuario ||
            !(await bcrypt.compare(senha, usuario.senha_hash))
        ) {
            return res.status(401).json({
                erro: 'E-mail ou senha inválidos.'
            });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET não configurado.');
        }

        const token = jwt.sign(
            {},
            process.env.JWT_SECRET,
            {
                subject: String(usuario.id),
                expiresIn: '1h'
            }
        );

        return res.status(200).json({
            mensagem: 'Login realizado com sucesso!',
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email
            }
        });

    } catch (erro) {
        next(erro);
    }
});

// GET /api/auth/me
router.get('/me', autenticar, async (req, res, next) => {
    try {
        const usuario = await buscarUsuarioPublicoPorId(
            req.usuarioId
        );

        if (!usuario) {
            return res.status(404).json({
                erro: 'Usuário não encontrado.'
            });
        }

        return res.status(200).json({ usuario });

    } catch (erro) {
        next(erro);
    }
});

export default router;