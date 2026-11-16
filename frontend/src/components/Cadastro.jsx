import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { validarCadastro } from '../services/validacoes.js';
import { mascaraCpf } from '../services/formatadores.js';
import Campo from './Campo.jsx';

const inicial = { nome: '', email: '', cpf: '', senha: '', confirmacao: '' };

export default function Cadastro() {
  const { cadastrar, autenticado } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(inicial);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (autenticado) return <Navigate to="/dashboard" replace />;

  const alterar = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: name === 'cpf' ? mascaraCpf(value) : value }));
  };

  async function enviar(e) {
    e.preventDefault();
    const novos = validarCadastro(form);
    setErros(novos);
    setErroGeral('');
    if (Object.keys(novos).length) return;

    setEnviando(true);
    try {
      await cadastrar({
        nome: form.nome.trim(),
        email: form.email.trim().toLowerCase(),
        cpf: form.cpf.replace(/\D/g, ''),
        senha: form.senha,
        confirmacaoSenha: form.confirmacao,
      });
      navigate('/login', { replace: true, state: { cadastrado: true } });
    } catch (err) {
      // 409/400: a API devolve { erro, campos: { email: '...', cpf: '...' } }
      setErros(err.campos ?? {});
      setErroGeral(err.campos && Object.keys(err.campos).length ? '' : err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="auth">
      <section className="auth__cartao">
        <h1>Criar conta</h1>
        <p className="auth__sub">Leva menos de um minuto.</p>

        {erroGeral && <p className="aviso aviso--erro" role="alert">{erroGeral}</p>}

        <form onSubmit={enviar} noValidate>
          <Campo rotulo="Nome" name="nome" autoComplete="name"
                 value={form.nome} onChange={alterar} erro={erros.nome} />
          <Campo rotulo="E-mail" name="email" type="email" autoComplete="email"
                 value={form.email} onChange={alterar} erro={erros.email} />
          <Campo rotulo="CPF" name="cpf" inputMode="numeric" placeholder="000.000.000-00"
                 value={form.cpf} onChange={alterar} erro={erros.cpf} />
          <Campo rotulo="Senha" name="senha" type="password" autoComplete="new-password"
                 ajuda="Mínimo de 8 caracteres, com letras e números."
                 value={form.senha} onChange={alterar} erro={erros.senha} />
          <Campo rotulo="Repita a senha" name="confirmacao" type="password" autoComplete="new-password"
                 value={form.confirmacao} onChange={alterar} erro={erros.confirmacao} />
          <button className="btn btn--primario" disabled={enviando}>
            {enviando ? 'Criando conta…' : 'Criar conta'}
          </button>
        </form>

        <p className="auth__rodape">Já tem conta? <Link to="/login">Entrar</Link></p>
      </section>
    </main>
  );
}
