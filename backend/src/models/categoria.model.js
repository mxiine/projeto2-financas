import { pool } from '../config/database.js';

// O usuarioId sempre vem do JWT, nunca do corpo da requisição.
export async function listarCategorias(usuarioId) {
  const [rows] = await pool.execute(
    `SELECT id, nome, tipo FROM categorias WHERE usuario_id = ? ORDER BY tipo, nome`,
    [usuarioId]
  );
  return rows;
}

export async function buscarCategoria(id, usuarioId) {
  const [rows] = await pool.execute(
    `SELECT id, nome, tipo FROM categorias WHERE id = ? AND usuario_id = ? LIMIT 1`,
    [id, usuarioId]
  );
  return rows[0] || null;
}

export async function criarCategoria({ usuarioId, nome, tipo }) {
  const [resultado] = await pool.execute(
    `INSERT INTO categorias (usuario_id, nome, tipo) VALUES (?, ?, ?)`,
    [usuarioId, nome, tipo]
  );
  return buscarCategoria(resultado.insertId, usuarioId);
}

export async function atualizarCategoria(id, usuarioId, { nome, tipo }) {
  await pool.execute(
    `UPDATE categorias SET nome = ?, tipo = ? WHERE id = ? AND usuario_id = ?`,
    [nome, tipo, id, usuarioId]
  );
  return buscarCategoria(id, usuarioId);
}

export async function possuiLancamentosCategoria(id, usuarioId) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM lancamentos WHERE categoria_id = ? AND usuario_id = ?`,
    [id, usuarioId]
  );
  return Number(rows[0].total) > 0;
}

export async function excluirCategoria(id, usuarioId) {
  const [resultado] = await pool.execute(
    `DELETE FROM categorias WHERE id = ? AND usuario_id = ?`,
    [id, usuarioId]
  );
  return resultado.affectedRows > 0;
}
