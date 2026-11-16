import { useAuth } from '../contexts/AuthContext.jsx';
import { formatarMoeda, mesCorrente, formatarData } from '../services/formatadores.js';

// Esqueleto do resumo do mês. Próximo passo: buscar GET /lancamentos (mês corrente)
// e preencher entradas, saídas e saldo com os totais devolvidos pela API.
export default function Dashboard() {
  const { usuario } = useAuth();
  const { inicio, fim } = mesCorrente();
  const totais = { entradas: 0, saidas: 0 };

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
          <strong className="valor">{formatarMoeda(totais.entradas - totais.saidas)}</strong>
        </div>
      </section>

      <p className="vazio">Você ainda não tem lançamentos neste mês.</p>
    </>
  );
}
