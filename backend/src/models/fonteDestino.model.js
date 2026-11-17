import { pool } from '../config/database.js';

// Listar fontes e destinos do usuário autenticado
export async function listarFontesDestinos(usuarioId) {
    const [rows] = await pool.execute(
        `SELECT
            id,
            nome,
            tipo,
            dia_fechamento AS diaFechamento,
            dia_vencimento AS diaVencimento,
            limite
         FROM fontes_destinos
         WHERE usuario_id = ?
         ORDER BY nome ASC`,
        [usuarioId]
    );

    return rows;
}

// Buscar uma fonte/destino específico
export async function buscarFonteDestino(id, usuarioId) {
    const [rows] = await pool.execute(
        `SELECT
            id,
            nome,
            tipo,
            dia_fechamento AS diaFechamento,
            dia_vencimento AS diaVencimento,
            limite
         FROM fontes_destinos
         WHERE id = ? AND usuario_id = ?
         LIMIT 1`,
        [id, usuarioId]
    );

    return rows[0] || null;
}

// Criar fonte/destino
export async function criarFonteDestino({
    usuarioId,
    nome,
    tipo,
    diaFechamento,
    diaVencimento,
    limite
}) {
    const [resultado] = await pool.execute(
        `INSERT INTO fontes_destinos
            (usuario_id, nome, tipo, dia_fechamento,
             dia_vencimento, limite)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            usuarioId,
            nome,
            tipo,
            diaFechamento,
            diaVencimento,
            limite
        ]
    );

    return buscarFonteDestino(resultado.insertId, usuarioId);
}

// Atualizar fonte/destino
export async function atualizarFonteDestino(id, usuarioId, dados) {
    const [resultado] = await pool.execute(
        `UPDATE fontes_destinos
         SET nome = ?,
             tipo = ?,
             dia_fechamento = ?,
             dia_vencimento = ?,
             limite = ?
         WHERE id = ? AND usuario_id = ?`,
        [
            dados.nome,
            dados.tipo,
            dados.diaFechamento,
            dados.diaVencimento,
            dados.limite,
            id,
            usuarioId
        ]
    );

    if (resultado.affectedRows === 0) {
        // Verifica se o registro existe e não sofreu alteração
        return buscarFonteDestino(id, usuarioId);
    }

    return buscarFonteDestino(id, usuarioId);
}

// Excluir fonte/destino
export async function excluirFonteDestino(id, usuarioId) {
    const [resultado] = await pool.execute(
        `DELETE FROM fontes_destinos
         WHERE id = ? AND usuario_id = ?`,
        [id, usuarioId]
    );

    return resultado.affectedRows > 0;
}

// Verificar lançamentos vinculados
export async function possuiLancamentos(id, usuarioId) {
    const [rows] = await pool.execute(
        `SELECT COUNT(*) AS total
         FROM lancamentos
         WHERE fonte_destino_id = ?
           AND usuario_id = ?`,
        [id, usuarioId]
    );

    return Number(rows[0].total) > 0;
}