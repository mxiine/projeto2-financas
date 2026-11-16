// Único ponto de comunicação com a API.
// - Adiciona Authorization: Bearer <token> automaticamente
// - Em 401 (token ausente/expirado) executa o handler de logout registrado pelo AuthContext
// - Normaliza erros no padrão { erro, campos } definido no enunciado

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
const TOKEN_KEY = 'financas.token';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

let onUnauthorized = null;
export function registrarHandlerNaoAutorizado(fn) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(status, erro, campos = {}) {
    super(erro);
    this.status = status;
    this.campos = campos; // { nomeDoCampo: 'mensagem' }
  }
}

function montarQuery(params) {
  const q = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.append(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

async function request(metodo, caminho, { body, params, publica = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = tokenStorage.get();
  if (token && !publica) headers.Authorization = `Bearer ${token}`;

  let resposta;
  try {
    resposta = await fetch(`${API_URL}${caminho}${montarQuery(params)}`, {
      method: metodo,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Não foi possível conectar ao servidor. Tente novamente.');
  }

  if (resposta.status === 204) return null;

  const dados = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    // 401 em rota protegida: sessão inválida/expirada → logout automático
    if (resposta.status === 401 && !publica && onUnauthorized) onUnauthorized();
    throw new ApiError(resposta.status, dados?.erro ?? 'Erro inesperado.', dados?.campos);
  }
  return dados;
}

export const api = {
  get: (caminho, params) => request('GET', caminho, { params }),
  post: (caminho, body, opcoes) => request('POST', caminho, { body, ...opcoes }),
  put: (caminho, body) => request('PUT', caminho, { body }),
  delete: (caminho, params) => request('DELETE', caminho, { params }),
};
