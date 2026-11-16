import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStorage, registrarHandlerNaoAutorizado } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => tokenStorage.get());
  const [usuario, setUsuario] = useState(null);
  // "carregando" = ainda validando o token salvo (evita piscar a tela de login no F5)
  const [carregando, setCarregando] = useState(() => Boolean(tokenStorage.get()));

  const logout = useCallback(() => {
    tokenStorage.clear();
    setToken(null);
    setUsuario(null);
  }, []);

  // Em qualquer 401 de rota protegida, o cliente HTTP chama logout → volta ao login
  useEffect(() => {
    registrarHandlerNaoAutorizado(logout);
    return () => registrarHandlerNaoAutorizado(null);
  }, [logout]);

  // Ao carregar a página com token salvo, confirma com a API quem é o usuário
  useEffect(() => {
    if (!tokenStorage.get()) {
      setCarregando(false);
      return;
    }
    let cancelado = false;
    api
      .get('/auth/me')
      .then((dados) => !cancelado && setUsuario(dados))
      .catch(() => {}) // 401 já dispara o logout pelo cliente HTTP
      .finally(() => !cancelado && setCarregando(false));
    return () => {
      cancelado = true;
    };
  }, []);

  const login = useCallback(async (email, senha) => {
    const dados = await api.post('/auth/login', { email, senha }, { publica: true });
    tokenStorage.set(dados.token);
    setToken(dados.token);
    setUsuario(dados.usuario);
    return dados.usuario;
  }, []);

  // O erro (409, 400) sobe para o formulário, que mostra as mensagens junto aos campos
  const cadastrar = useCallback(
    (dados) => api.post('/auth/cadastro', dados, { publica: true }),
    []
  );

  const valor = useMemo(
    () => ({ usuario, token, autenticado: Boolean(token), carregando, login, logout, cadastrar }),
    [usuario, token, carregando, login, logout, cadastrar]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
