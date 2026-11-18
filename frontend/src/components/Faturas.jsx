import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { formatarMoeda, formatarData } from '../services/formatadores.js';
import Estado from './Estado.jsx';

const STATUS = { aberta: 'Aberta', fechada: 'Fechada', futura: 'Prevista' };

export default function Faturas() {
  const [meses, setMeses] = useState(3);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setDados(await api.get('/relatorios/faturas', { meses }));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [meses]);
  useEffect(() => { carregar(); }, [carregar]);

  return (
    <>
      <header className="pagina__cab">
        <h1>Faturas</h1>
        <p>Fatura atual e previsão das próximas, incluindo as parcelas futuras.</p>
      </header>

      <section className="painel">
        <div className="grade-form">
          <div className="campo">
            <label htmlFor="meses">Próximas faturas</label>
            <select id="meses" value={meses} onChange={(e) => setMeses(Number(e.target.value))}>
              {[3, 4, 6, 12].map((n) => <option key={n} value={n}>{n} meses</option>)}
            </select>
          </div>
        </div>
      </section>

      <Estado carregando={carregando} erro={erro} onTentar={carregar} vazio={dados && !dados.cartoes.length}
              textoVazio="Você não tem cartões de crédito. Cadastre um em “Fontes e destinos”." />

      {!carregando && !erro && dados?.cartoes.map(({ cartao, limite, limiteUtilizado, limiteDisponivel, faturas }) => {
        const uso = limite > 0 ? Math.min(100, (limiteUtilizado / limite) * 100) : 0;
        return (
          <section className="painel" key={cartao.id}>
            <h2>{cartao.nome}</h2>
            <p className="campo__ajuda">Fecha dia {cartao.diaFechamento} · vence dia {cartao.diaVencimento}</p>

            <div className="resumo resumo--compacto">
              <div className="resumo__item"><span>Limite</span><strong>{formatarMoeda(limite)}</strong></div>
              <div className="resumo__item"><span>Utilizado</span><strong className="valor--saida">{formatarMoeda(limiteUtilizado)}</strong></div>
              <div className="resumo__item"><span>Disponível</span><strong className={limiteDisponivel < 0 ? 'valor--saida' : 'valor--entrada'}>{formatarMoeda(limiteDisponivel)}</strong></div>
            </div>
            <div className="barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(uso)} aria-label="Limite utilizado">
              <div className="barra__preenchida" style={{ width: `${uso}%` }} />
            </div>

            <div className="faturas">
              {faturas.map((f) => (
                <details key={f.referencia} className={`fatura fatura--${f.status}`} open={f.status === 'aberta'}>
                  <summary>
                    <span><strong>Fatura {f.referencia.slice(5)}/{f.referencia.slice(0, 4)}</strong> <span className="selo">{STATUS[f.status]}</span></span>
                    <span className="fatura__datas">fecha {formatarData(f.fechamento)} · vence {formatarData(f.vencimento)}</span>
                    <strong>{formatarMoeda(f.total)}</strong>
                  </summary>
                  {f.lancamentos.length === 0 ? <p className="vazio">Nenhum lançamento nesta fatura.</p> : (
                    <ul className="lista-simples">
                      {f.lancamentos.map((l) => (
                        <li key={l.id}>
                          <span>
                            <strong>{l.rotuloParcela}</strong>
                            <small>compra em {formatarData(l.dataCompra)} · {l.categoria}</small>
                          </span>
                          <span>{formatarMoeda(l.valor)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
