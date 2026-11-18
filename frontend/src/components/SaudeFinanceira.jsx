import { useCallback, useEffect, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api.js';
import { formatarMoeda } from '../services/formatadores.js';
import Estado from './Estado.jsx';

const pct = (n) => (n === null || n === undefined ? '—' : `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
const NOMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloMes = (m) => `${NOMES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;

export default function SaudeFinanceira() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setDados(await api.get('/saude-financeira'));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const ind = dados?.indicadores;
  const grafico = dados?.projecao.meses.map((m) => ({ ...m, rotulo: rotuloMes(m.mes) })) ?? [];

  return (
    <>
      <header className="pagina__cab">
        <h1>Saúde financeira</h1>
        <p>Indicadores, projeções e dicas calculados a partir dos seus próprios dados.</p>
      </header>

      <p className="aviso aviso--ok" role="note">
        <strong>Importante:</strong> as informações desta página são educativas e não constituem recomendação financeira profissional.
      </p>

      <Estado carregando={carregando} erro={erro} onTentar={carregar} />

      {!carregando && !erro && dados && (
        <>
          <section className="painel">
            <h2>Dicas para você</h2>
            <ul className="dicas">
              {dados.dicas.map((d, i) => (
                <li key={i} className={`dica dica--${d.nivel}`}>{d.texto}</li>
              ))}
            </ul>
          </section>

          <section className="painel">
            <h2>Projeção de saldo (próximos 6 meses)</h2>
            <p className="campo__ajuda">
              Saldo estimado hoje: <strong>{formatarMoeda(dados.projecao.saldoInicialEstimado)}</strong> · média de entradas {formatarMoeda(dados.projecao.mediaEntradas)}/mês ·
              saídas à vista {formatarMoeda(dados.projecao.mediaSaidasAVista)}/mês + faturas de cartão previstas (ou a média de {formatarMoeda(dados.projecao.mediaCartao)}/mês, o que for maior).
            </p>
            <div className="grafico" role="img" aria-label="Gráfico de linha do saldo projetado">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={grafico}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="rotulo" />
                  <YAxis tickFormatter={(v) => formatarMoeda(v).replace(',00', '')} width={95} />
                  <Tooltip formatter={(v) => formatarMoeda(v)} />
                  <Legend />
                  <ReferenceLine y={0} stroke="#b23a2c" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="saldo" name="Saldo projetado" stroke="#0d5c63" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="painel">
            <h2>Taxa de poupança</h2>
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead><tr><th>Mês</th><th className="num">Entradas</th><th className="num">Saídas</th><th className="num">Taxa</th></tr></thead>
                <tbody>{ind.taxaPoupanca.map((t) => (
                  <tr key={t.mes}>
                    <td>{rotuloMes(t.mes)}</td>
                    <td className="num">{formatarMoeda(t.entradas)}</td>
                    <td className="num">{formatarMoeda(t.saidas)}</td>
                    <td className={`num ${t.taxa !== null && t.taxa < 0 ? 'valor--saida' : ''}`}>{pct(t.taxa)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>

          <div className="duas-colunas">
            <section className="painel">
              <h2>Comprometimento com cartões</h2>
              <p className="valor">{pct(ind.comprometimentoCartoes.percentual)}</p>
              <p className="campo__ajuda">
                Próximas {ind.comprometimentoCartoes.meses} fatura(s): {formatarMoeda(ind.comprometimentoCartoes.totalProximasFaturas)} · renda média {formatarMoeda(ind.comprometimentoCartoes.rendaMediaMensal)}/mês
              </p>
            </section>
            <section className="painel">
              <h2>Parcelas futuras</h2>
              {ind.parcelasFuturas.length === 0 ? <p className="vazio">Nenhuma parcela a vencer.</p> : (
                <table className="tabela">
                  <tbody>{ind.parcelasFuturas.map((p) => (
                    <tr key={p.mes}><td>{rotuloMes(p.mes)}</td><td className="num">{formatarMoeda(p.total)}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </section>
          </div>

          <div className="duas-colunas">
            <section className="painel">
              <h2>Regra 50/30/20 (mês atual)</h2>
              {!ind.regra503020 ? <p className="vazio">Sem renda registrada.</p> : (
                <table className="tabela">
                  <thead><tr><th>Grupo</th><th className="num">Você</th><th className="num">Referência</th></tr></thead>
                  <tbody>
                    {[['Necessidades', ind.regra503020.necessidades], ['Desejos', ind.regra503020.desejos], ['Poupança', ind.regra503020.poupanca]].map(([n, v]) => (
                      <tr key={n}><td>{n}</td><td className="num">{pct(v.percentual)} ({formatarMoeda(v.valor)})</td><td className="num">{v.referencia}%</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            <section className="painel">
              <h2>Categorias fora da curva</h2>
              {ind.foraDaCurva.length === 0 ? <p className="vazio">Nenhuma categoria muito acima da média.</p> : (
                <table className="tabela">
                  <thead><tr><th>Categoria</th><th className="num">Este mês</th><th className="num">Média 3 meses</th></tr></thead>
                  <tbody>{ind.foraDaCurva.map((f) => (
                    <tr key={f.categoria}><td>{f.categoria} <span className="selo">+{pct(f.percentualAcima)}</span></td><td className="num">{formatarMoeda(f.atual)}</td><td className="num">{formatarMoeda(f.media)}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
