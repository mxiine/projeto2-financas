import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../services/api.js';
import { formatarMoeda, mesCorrente, formatarData } from '../services/formatadores.js';
import Estado from './Estado.jsx';

export default function Dashboard() {
  const { usuario } = useAuth();
  const { inicio, fim } = mesCorrente();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      setDados(await api.get('/lancamentos', { inicio, fim, pagina: 1, porPagina: 5 }));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totais = dados?.totais ?? { entradas: 0, saidas: 0, saldo: 0 };

  return (
    <>
      <header className="pagina__cab">
        <h1>Olá, {usuario?.nome?.split(' ')[0]}</h1>
        <p>{formatarData(inicio)} a {formatarData(fim)}</p>
      </header>

      <section className="resumo" aria-label="Resumo do mês">
        <div className="resumo__item">
          <span>Entradas</span>
          <strong className="valor valor--entrada">{formatarMoeda(totais.entradas)}</strong>
        </div>
        <div className="resumo__item">
          <span>Saídas</span>
          <strong className="valor valor--saida">{formatarMoeda(totais.saidas)}</strong>
        </div>
        <div className="resumo__item resumo__item--saldo">
          <span>Saldo do mês</span>
          <strong className="valor">{formatarMoeda(totais.saldo)}</strong>
        </div>
      </section>

      <section className="painel">
        <h2>Últimos lançamentos</h2>
        <Estado carregando={carregando} erro={erro} onTentar={carregar}
                vazio={!dados?.lancamentos?.length} textoVazio="Você ainda não tem lançamentos neste mês." />
        {!carregando && !erro && dados?.lancamentos?.length > 0 && (
          <ul className="lista-simples">
            {dados.lancamentos.map((l) => (
              <li key={l.id}>
                <span>
                  <strong>{l.descricao}</strong>
                  {l.totalParcelas > 1 && <span className="selo">{l.parcelaAtual}/{l.totalParcelas}</span>}
                  <small>{formatarData(l.data)} · {l.categoria} · {l.fonteDestino}</small>
                </span>
                <span className={`valor--${l.tipo}`}>{l.tipo === 'entrada' ? '+' : '−'} {formatarMoeda(l.valor)}</span>
              </li>
            ))}
          </ul>
        )}
        <p><Link to="/lancamentos">Ver todos os lançamentos</Link></p>
      </section>
    </>
  );
}
