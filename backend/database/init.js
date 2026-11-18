import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const diretorioAtual = path.dirname(fileURLToPath(import.meta.url));

// Localiza o .env na raiz do backend
const caminhoEnv = path.resolve(diretorioAtual, '../.env');

dotenv.config({ path: caminhoEnv });

const {
    DB_HOST,
    DB_PORT,
    DB_USER,
    DB_PASSWORD,
    DB_NAME
} = process.env;

// Validar as configurações
if (!DB_HOST || !DB_USER || !DB_NAME) {
    throw new Error(
        'Confira DB_HOST, DB_USER e DB_NAME no arquivo .env.'
    );
}

// Evita injeção no nome do banco
if (!/^[a-zA-Z0-9_]+$/.test(DB_NAME)) {
    throw new Error('Nome do banco de dados inválido.');
}

async function inicializarBanco() {
    let conexao;

    try {
        console.log('Iniciando configuração do banco...');

        // Conectar ao servidor MySQL sem selecionar um banco
        conexao = await mysql.createConnection({
            host: DB_HOST,
            port: Number(DB_PORT || 3306),
            user: DB_USER,
            password: DB_PASSWORD || ''
        });

        // Criar banco caso ainda não exista
        await conexao.query(`
            CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
            CHARACTER SET utf8mb4
            COLLATE utf8mb4_unicode_ci
        `);

        console.log(`Banco "${DB_NAME}" disponível.`);

        // Selecionar o banco criado
        await conexao.changeUser({
            database: DB_NAME
        });

        // Ler o schema.sql existente
        const caminhoSchema = path.join(
            diretorioAtual,
            'schema.sql'
        );

        const schema = await fs.readFile(
            caminhoSchema,
            'utf8'
        );

        // Separar os comandos SQL
        // O seu schema possui CREATE TABLE separados por ;
        const comandos = schema
            .split(';')
            .map(comando => comando.trim())
            .filter(comando => comando.length > 0);

        if (comandos.length === 0) {
            throw new Error('O arquivo schema.sql está vazio.');
        }

        let criadas = 0;
        let existentes = 0;

        // Executar cada comando SQL
        for (const comando of comandos) {
            try {
                await conexao.query(comando);

                criadas++;

                console.log('Tabela criada com sucesso.');

            } catch (erro) {

                // Não interromper quando a tabela já existe
                if (erro.code === 'ER_TABLE_EXISTS_ERROR') {
                    existentes++;

                    console.log('Tabela já existe. Mantendo estrutura atual.');

                } else {
                    throw erro;
                }
            }
        }

        console.log('\nInicialização concluída!');
        console.log(`Comandos executados: ${criadas}`);
        console.log(`Tabelas já existentes: ${existentes}`);
        console.log(`Banco utilizado: ${DB_NAME}`);

    } catch (erro) {
        console.error('\nErro ao inicializar o banco:');
        console.error(erro.message);

        process.exitCode = 1;

    } finally {
        if (conexao) {
            await conexao.end();
        }
    }
}

inicializarBanco();