import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import Campo from './Campo.jsx';

export default function Login() {
  const { login, autenticado } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', senha: '' });
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (autenticado) return <Navigate to="/dashboard" replace />;

  const alterar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function enviar(e) {
    e.preventDefault();
    const novos = {};
    if (!form.email.trim()) novos.email = 'Informe seu e-mail.';
    if (!form.senha) novos.senha = 'Informe sua senha.';
    setErros(novos);
    setErroGeral('');
    if (Object.keys(novos).length) return;

    setEnviando(true);
    try {
      await login(form.email.trim().toLowerCase(), form.senha);
      navigate(location.state?.de?.pathname ?? '/dashboard', { replace: true });
    } catch (err) {
      setErroGeral(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="auth">
      <section className="auth__cartao">
        <h1>Entrar</h1>
        <p className="auth__sub">Acesse suas finanças.</p>

        {location.state?.cadastrado && (
          <p className="aviso aviso--ok" role="status">Conta criada. Entre com seu e-mail e senha.</p>
        )}
        {erroGeral && <p className="aviso aviso--erro" role="alert">{erroGeral}</p>}

        <form onSubmit={enviar} noValidate>
          <Campo rotulo="E-mail" name="email" type="email" autoComplete="email"
                 value={form.email} onChange={alterar} erro={erros.email} />
          <Campo rotulo="Senha" name="senha" type="password" autoComplete="current-password"
                 value={form.senha} onChange={alterar} erro={erros.senha} />
          <button className="btn btn--primario" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="auth__rodape">Ainda não tem conta? <Link to="/cadastro">Criar conta</Link></p>
      </section>
    </main>
  );
}
