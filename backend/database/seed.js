import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const diretorioAtual = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({
    path: path.resolve(diretorioAtual, '../.env')
});

const {
    DB_HOST,
    DB_PORT,
    DB_USER,
    DB_PASSWORD,
    DB_NAME
} = process.env;

// Conferir configurações do banco
if (!DB_HOST || !DB_USER || !DB_NAME) {
    throw new Error('Confira as configurações do MySQL no arquivo .env.');
}

// Criar pool de conexões
const pool = mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT || 3306),
    user: DB_USER,
    password: DB_PASSWORD || '',
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 5
});

// Usuários de demonstração
const usuariosDemo = [
    {
        nome: 'Ana Demonstração',
        email: 'ana.demo@financas.local',
        cpf: '68419352098',
        senha: 'Demo1234!',
        salario: 380000,
        moradia: 135000,
        alimentacao: 52000,
        mobilidade: 18000,
        saude: 9000,
        limiteCartao: 500000,
        nomeCartao: 'Cartão Nubank',
        fechamento: 3,
        vencimento: 10
    },
    {
        nome: 'Bruno Demonstração',
        email: 'bruno.demo@financas.local',
        cpf: '93541134780',
        senha: 'Demo1234!',
        salario: 420000,
        moradia: 150000,
        alimentacao: 61000,
        mobilidade: 22000,
        saude: 11000,
        limiteCartao: 800000,
        nomeCartao: 'Cartão Visa',
        fechamento: 25,
        vencimento: 5
    }
];

// Converter centavos para valor monetário
function valorMonetario(centavos) {
    return (centavos / 100).toFixed(2);
}

// Gerar uma data válida nos últimos meses
function dataDoMes(mesesAtras, dia) {
    const hoje = new Date();

    const data = new Date(
        hoje.getFullYear(),
        hoje.getMonth() - mesesAtras,
        1
    );

    const ultimoDia = new Date(
        data.getFullYear(),
        data.getMonth() + 1,
        0
    ).getDate();

    let diaFinal = Math.min(dia, ultimoDia);

    // Não criar movimentações futuras no mês atual
    if (mesesAtras === 0) {
        diaFinal = Math.min(diaFinal, hoje.getDate());
    }

    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const diaFormatado = String(diaFinal).padStart(2, '0');

    return `${ano}-${mes}-${diaFormatado}`;
}

// Gerar identificador consistente para parcelamentos
function gerarGrupoParcelamento(chave) {
    const hash = createHash('sha256')
        .update(chave)
        .digest('hex');

    return [
        hash.substring(0, 8),
        hash.substring(8, 12),
        `4${hash.substring(13, 16)}`,
        `a${hash.substring(17, 20)}`,
        hash.substring(20, 32)
    ].join('-');
}

// Criar ou recuperar usuário
async function garantirUsuario(conexao, usuario) {
    const [encontrados] = await conexao.execute(
        `SELECT id, cpf
         FROM usuarios
         WHERE email = ?
         LIMIT 1`,
        [usuario.email]
    );

    if (encontrados.length > 0) {
    const existente = encontrados[0];

    if (existente.cpf !== usuario.cpf) {
        throw new Error(
            `O e-mail ${usuario.email} já está cadastrado com outro CPF.`
        );
    }

    // Atualizar a senha do usuário de demonstração
    const senhaHash = await bcrypt.hash(usuario.senha, 10);

    await conexao.execute(
        `UPDATE usuarios
         SET senha_hash = ?
         WHERE id = ?`,
        [senhaHash, existente.id]
    );

    return existente.id;
}

    const [cpfExistente] = await conexao.execute(
        `SELECT id
         FROM usuarios
         WHERE cpf = ?
         LIMIT 1`,
        [usuario.cpf]
    );

    if (cpfExistente.length > 0) {
        throw new Error(
            `O CPF de ${usuario.nome} já está cadastrado.`
        );
    }

    const senhaHash = await bcrypt.hash(usuario.senha, 10);

    const [resultado] = await conexao.execute(
        `INSERT INTO usuarios
         (nome, email, cpf, senha_hash)
         VALUES (?, ?, ?, ?)`,
        [
            usuario.nome,
            usuario.email,
            usuario.cpf,
            senhaHash
        ]
    );

    return resultado.insertId;
}

// Criar ou recuperar categoria
async function garantirCategoria(
    conexao,
    usuarioId,
    nome,
    tipo
) {
    const [existentes] = await conexao.execute(
        `SELECT id
         FROM categorias
         WHERE usuario_id = ?
           AND nome = ?
           AND tipo = ?
         LIMIT 1`,
        [usuarioId, nome, tipo]
    );

    if (existentes.length > 0) {
        return existentes[0].id;
    }

    const [resultado] = await conexao.execute(
        `INSERT INTO categorias
         (usuario_id, nome, tipo)
         VALUES (?, ?, ?)`,
        [usuarioId, nome, tipo]
    );

    return resultado.insertId;
}

// Criar ou recuperar fonte/destino
async function garantirFonte(conexao, usuarioId, fonte) {
    const [existentes] = await conexao.execute(
        `SELECT id, tipo
         FROM fontes_destinos
         WHERE usuario_id = ?
           AND nome = ?
         LIMIT 1`,
        [usuarioId, fonte.nome]
    );

    if (existentes.length > 0) {
        const existente = existentes[0];

        if (existente.tipo !== fonte.tipo) {
            throw new Error(
                `A fonte ${fonte.nome} já existe com outro tipo.`
            );
        }

        if (fonte.tipo === 'cartao_credito') {
            await conexao.execute(
                `UPDATE fontes_destinos
                 SET dia_fechamento = ?,
                     dia_vencimento = ?,
                     limite = ?
                 WHERE id = ? AND usuario_id = ?`,
                [
                    fonte.diaFechamento,
                    fonte.diaVencimento,
                    valorMonetario(fonte.limite),
                    existente.id,
                    usuarioId
                ]
            );
        }

        return existente.id;
    }

    const [resultado] = await conexao.execute(
        `INSERT INTO fontes_destinos
         (
            usuario_id,
            nome,
            tipo,
            dia_fechamento,
            dia_vencimento,
            limite
         )
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            usuarioId,
            fonte.nome,
            fonte.tipo,
            fonte.diaFechamento ?? null,
            fonte.diaVencimento ?? null,
            fonte.limite != null
                ? valorMonetario(fonte.limite)
                : null
        ]
    );

    return resultado.insertId;
}

// Inserir lançamento sem duplicar dados de demonstração
async function garantirLancamento(conexao, lancamento) {
    const [existentes] = await conexao.execute(
        `SELECT id
         FROM lancamentos
         WHERE usuario_id = ?
           AND tipo = ?
           AND descricao = ?
           AND valor = ?
           AND data = ?
           AND categoria_id = ?
           AND fonte_destino_id = ?
           AND parcela_atual = ?
           AND total_parcelas = ?
           AND grupo_parcelamento <=> ?
         LIMIT 1`,
        [
            lancamento.usuarioId,
            lancamento.tipo,
            lancamento.descricao,
            valorMonetario(lancamento.valor),
            lancamento.data,
            lancamento.categoriaId,
            lancamento.fonteDestinoId,
            lancamento.parcelaAtual,
            lancamento.totalParcelas,
            lancamento.grupoParcelamento
        ]
    );

    if (existentes.length > 0) {
        return existentes[0].id;
    }

    const [resultado] = await conexao.execute(
        `INSERT INTO lancamentos
         (
            usuario_id,
            tipo,
            descricao,
            valor,
            data,
            categoria_id,
            fonte_destino_id,
            parcela_atual,
            total_parcelas,
            grupo_parcelamento
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            lancamento.usuarioId,
            lancamento.tipo,
            lancamento.descricao,
            valorMonetario(lancamento.valor),
            lancamento.data,
            lancamento.categoriaId,
            lancamento.fonteDestinoId,
            lancamento.parcelaAtual,
            lancamento.totalParcelas,
            lancamento.grupoParcelamento
        ]
    );

    return resultado.insertId;
}

// Criar movimentação comum
async function criarMovimentacao(
    conexao,
    usuarioId,
    tipo,
    descricao,
    valor,
    data,
    categoriaId,
    fonteDestinoId
) {
    await garantirLancamento(conexao, {
        usuarioId,
        tipo,
        descricao,
        valor,
        data,
        categoriaId,
        fonteDestinoId,
        parcelaAtual: 1,
        totalParcelas: 1,
        grupoParcelamento: null
    });
}

// Criar compra parcelada
async function criarParcelamento(
    conexao,
    usuarioId,
    descricao,
    valorTotal,
    numeroParcelas,
    data,
    categoriaId,
    cartaoId
) {
    const grupo = gerarGrupoParcelamento(
        `${usuarioId}-${descricao}-${data}`
    );

    const valorBase = Math.floor(
        valorTotal / numeroParcelas
    );

    const resto = valorTotal % numeroParcelas;

    for (let i = 1; i <= numeroParcelas; i++) {
        const valorParcela =
            valorBase + (i === 1 ? resto : 0);

        await garantirLancamento(conexao, {
            usuarioId,
            tipo: 'saida',
            descricao,
            valor: valorParcela,
            data,
            categoriaId,
            fonteDestinoId: cartaoId,
            parcelaAtual: i,
            totalParcelas: numeroParcelas,
            grupoParcelamento: grupo
        });
    }
}

// Popular os dados de um usuário
async function popularUsuario(conexao, usuario) {
    console.log(`Preparando dados de ${usuario.nome}...`);

    const usuarioId = await garantirUsuario(conexao, usuario);

    // Categorias iniciais
    const categorias = {};

    const categoriasIniciais = [
        ['Salário', 'entrada'],
        ['Freelance', 'entrada'],
        ['Alimentação', 'saida'],
        ['Moradia', 'saida'],
        ['Saúde', 'saida'],
        ['Mobilidade', 'saida'],
        ['Lazer', 'saida'],
        ['Educação', 'saida'],
        ['Outros', 'saida']
    ];

    for (const [nome, tipo] of categoriasIniciais) {
        categorias[nome] = await garantirCategoria(
            conexao,
            usuarioId,
            nome,
            tipo
        );
    }

    // Fontes e destinos
    const salarioId = await garantirFonte(conexao, usuarioId, {
        nome: 'Salário',
        tipo: 'renda'
    });

    const contaId = await garantirFonte(conexao, usuarioId, {
        nome: 'Conta corrente',
        tipo: 'conta'
    });

    const cartaoId = await garantirFonte(conexao, usuarioId, {
        nome: usuario.nomeCartao,
        tipo: 'cartao_credito',
        diaFechamento: usuario.fechamento,
        diaVencimento: usuario.vencimento,
        limite: usuario.limiteCartao
    });

    // Criar movimentações dos últimos três meses
    for (let deslocamento = 2; deslocamento >= 0; deslocamento--) {
        const mesAno = dataDoMes(deslocamento, 1).substring(0, 7);

        const lancamentos = [
            {
                tipo: 'entrada',
                descricao: `[DEMO] Salário - ${mesAno}`,
                valor: usuario.salario,
                dia: 5,
                categoria: categorias['Salário'],
                fonte: salarioId
            },
            {
                tipo: 'saida',
                descricao: `[DEMO] Aluguel - ${mesAno}`,
                valor: usuario.moradia,
                dia: 8,
                categoria: categorias['Moradia'],
                fonte: contaId
            },
            {
                tipo: 'saida',
                descricao: `[DEMO] Supermercado - ${mesAno}`,
                valor: usuario.alimentacao,
                dia: 10,
                categoria: categorias['Alimentação'],
                fonte: cartaoId
            },
            {
                tipo: 'saida',
                descricao: `[DEMO] Transporte - ${mesAno}`,
                valor: usuario.mobilidade,
                dia: 12,
                categoria: categorias['Mobilidade'],
                fonte: contaId
            },
            {
                tipo: 'saida',
                descricao: `[DEMO] Farmácia - ${mesAno}`,
                valor: usuario.saude,
                dia: 14,
                categoria: categorias['Saúde'],
                fonte: contaId
            }
        ];

        for (const item of lancamentos) {
            await criarMovimentacao(
                conexao,
                usuarioId,
                item.tipo,
                item.descricao,
                item.valor,
                dataDoMes(deslocamento, item.dia),
                item.categoria,
                item.fonte
            );
        }
    }

    // Compra de R$ 100,00 em três parcelas
    await criarParcelamento(
        conexao,
        usuarioId,
        '[DEMO] Compra parcelada - Eletrodoméstico',
        10000,
        3,
        dataDoMes(0, 14),
        categorias['Outros'],
        cartaoId
    );

    console.log(`Dados de ${usuario.nome} preparados.`);
}

// Executar seed
async function executarSeed() {
    let conexao;

    try {
        console.log('Iniciando carga de demonstração...');

        conexao = await pool.getConnection();

        await conexao.beginTransaction();

        for (const usuario of usuariosDemo) {
            await popularUsuario(conexao, usuario);
        }

        await conexao.commit();

        console.log('\nSeed executado com sucesso!');

        console.log('\nUsuário 1:');
        console.log('E-mail: ana.demo@financas.local');
        console.log('Senha: Demo1234!');

        console.log('\nUsuário 2:');
        console.log('E-mail: bruno.demo@financas.local');
        console.log('Senha: Demo1234!');

        console.log('\nMovimentações dos três meses preparadas.');

    } catch (erro) {
        if (conexao) {
            await conexao.rollback();
        }

        console.error('\nErro ao executar seed:');
        console.error(erro);

        process.exitCode = 1;

    } finally {
        if (conexao) {
            conexao.release();
        }

        await pool.end();
    }
}

executarSeed();
