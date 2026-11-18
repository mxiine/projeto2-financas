import { useCallback, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api.js';
import { formatarMoeda, formatarData, mesCorrente } from '../services/formatadores.js';
import Estado from './Estado.jsx';
import SeletorPeriodo from './SeletorPeriodo.jsx';

const CORES = ['#0d5c63', '#b23a2c', '#d9a441', '#4a7c59', '#6b5b95', '#c4663a', '#3a86a8', '#8c8c3a', '#a05a7a', '#5a6b78'];
const pct = (n) => `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

function Tendencia({ item }) {
  if (item.tendencia === 'estavel') return <span>sem variação</span>;
  const classe = item.tendencia === 'aumento' ? 'valor--saida' : 'valor--entrada';
  const seta = item.tendencia === 'aumento' ? '▲' : '▼';
  return (
    <span className={classe}>
      {seta} {formatarMoeda(Math.abs(item.variacao))}
      {item.variacaoPercentual !== null && ` (${pct(Math.abs(item.variacaoPercentual))})`}
    </span>
  );
}

function PorCategoria({ periodo }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setDados(await api.get('/relatorios/categorias', periodo));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [periodo]);
  useEffect(() => { carregar(); }, [carregar]);

  const saidas = dados?.categorias ?? [];
  const grafico = saidas.filter((c) => c.total > 0).map((c) => ({ name: c.nome, value: c.total }));

  return (
    <>
      <Estado carregando={carregando} erro={erro} onTentar={carregar} vazio={!saidas.length && !dados?.entradas?.length} textoVazio="Sem lançamentos neste período." />
      {!carregando && !erro && dados && (saidas.length > 0 || dados.entradas.length > 0) && (
        <>
          <section className="painel">
            <h2>Saídas por categoria</h2>
            <p className="campo__ajuda">
              Total: <strong>{formatarMoeda(dados.totalSaidas)}</strong> · comparação com {formatarData(dados.periodoAnterior.inicio)} a {formatarData(dados.periodoAnterior.fim)}
            </p>
            {grafico.length > 0 && (
              <div className="grafico" role="img" aria-label="Gráfico de rosca das saídas por categoria">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={grafico} dataKey="value" nameKey="name" innerRadius={60} outerRadius={105} paddingAngle={2}>
                      {grafico.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatarMoeda(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr><th>Categoria</th><th className="num">Total</th><th className="num">% das saídas</th><th className="num">Período anterior</th><th>Variação</th></tr>
                </thead>
                <tbody>
                  {saidas.map((c) => (
                    <tr key={c.id}>
                      <td>{c.nome}</td>
                      <td className="num">{formatarMoeda(c.total)}</td>
                      <td className="num">{pct(c.percentual)}</td>
                      <td className="num">{formatarMoeda(c.periodoAnterior)}</td>
                      <td><Tendencia item={c} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="painel">
            <h2>Entradas por categoria</h2>
            <p className="campo__ajuda">Total: <strong>{formatarMoeda(dados.totalEntradas)}</strong></p>
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr><th>Categoria</th><th className="num">Total</th><th className="num">% das entradas</th><th className="num">Período anterior</th><th>Variação</th></tr>
                </thead>
                <tbody>
                  {dados.entradas.map((c) => (
                    <tr key={c.id}>
                      <td>{c.nome}</td>
                      <td className="num">{formatarMoeda(c.total)}</td>
                      <td className="num">{pct(c.percentual)}</td>
                      <td className="num">{formatarMoeda(c.periodoAnterior)}</td>
                      <td><Tendencia item={c} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function PorFonteDestino({ periodo }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setDados(await api.get('/relatorios/fontes-destinos', periodo));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [periodo]);
  useEffect(() => { carregar(); }, [carregar]);

  const vazio = dados && !dados.entradasPorFonte.length && !dados.saidasPorDestino.length;
  const grafico = dados
    ? Object.values([
        ...dados.entradasPorFonte.map((i) => ({ nome: i.nome, entradas: i.total })),
        ...dados.saidasPorDestino.map((i) => ({ nome: i.nome, saidas: i.total })),
      ].reduce((acc, i) => ({ ...acc, [i.nome]: { ...acc[i.nome], ...i } }), {}))
    : [];

  return (
    <>
      <Estado carregando={carregando} erro={erro} onTentar={carregar} vazio={vazio} textoVazio="Sem lançamentos neste período." />
      {!carregando && !erro && dados && !vazio && (
        <>
          <section className="painel">
            <h2>Movimentação por fonte/destino</h2>
            <div className="grafico" role="img" aria-label="Gráfico de barras de entradas e saídas por fonte ou destino">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={grafico}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" />
                  <YAxis tickFormatter={(v) => formatarMoeda(v).replace(',00', '')} width={90} />
                  <Tooltip formatter={(v) => formatarMoeda(v)} />
                  <Legend />
                  <Bar dataKey="entradas" name="Entradas" fill="#1b7a4b" />
                  <Bar dataKey="saidas" name="Saídas" fill="#b23a2c" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="duas-colunas">
            <section className="painel">
              <h2>Entradas por fonte</h2>
              <p className="campo__ajuda">Total: <strong>{formatarMoeda(dados.totalEntradas)}</strong></p>
              {dados.entradasPorFonte.length === 0 ? <p className="vazio">Sem entradas.</p> : (
                <table className="tabela">
                  <tbody>{dados.entradasPorFonte.map((i) => (
                    <tr key={i.id}><td>{i.nome}</td><td className="num valor--entrada">{formatarMoeda(i.total)}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </section>
            <section className="painel">
              <h2>Saídas por destino</h2>
              <p className="campo__ajuda">Total: <strong>{formatarMoeda(dados.totalSaidas)}</strong></p>
              {dados.saidasPorDestino.length === 0 ? <p className="vazio">Sem saídas.</p> : (
                <table className="tabela">
                  <tbody>{dados.saidasPorDestino.map((i) => (
                    <tr key={i.id}><td>{i.nome}</td><td className="num valor--saida">{formatarMoeda(i.total)}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </section>
          </div>

          <section className="painel">
            <h2>Saldo das contas no período</h2>
            {dados.saldoContas.length === 0 ? <p className="vazio">Nenhuma conta cadastrada.</p> : (
              <div className="tabela-rolagem">
                <table className="tabela">
                  <thead><tr><th>Conta</th><th className="num">Entradas</th><th className="num">Saídas</th><th className="num">Saldo</th></tr></thead>
                  <tbody>{dados.saldoContas.map((c) => (
                    <tr key={c.id}>
                      <td>{c.nome}</td>
                      <td className="num">{formatarMoeda(c.entradas)}</td>
                      <td className="num">{formatarMoeda(c.saidas)}</td>
                      <td className={`num ${c.saldo < 0 ? 'valor--saida' : 'valor--entrada'}`}>{formatarMoeda(c.saldo)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

export default function Relatorios() {
  const [periodo, setPeriodo] = useState(mesCorrente);
  const [aba, setAba] = useState('categorias');
  const periodoValido = periodo.inicio && periodo.fim && periodo.inicio <= periodo.fim;

  return (
    <>
      <header className="pagina__cab">
        <h1>Relatórios</h1>
        <p>Totais calculados no servidor para o período escolhido.</p>
      </header>

      <section className="painel">
        <SeletorPeriodo inicio={periodo.inicio} fim={periodo.fim} onChange={setPeriodo} />
        {!periodoValido && <p className="aviso aviso--erro" role="alert">A data final deve ser igual ou posterior à inicial.</p>}
        <div className="abas" role="tablist">
          <button role="tab" aria-selected={aba === 'categorias'} className={aba === 'categorias' ? 'ativa' : ''} onClick={() => setAba('categorias')}>Por categoria</button>
          <button role="tab" aria-selected={aba === 'fontes'} className={aba === 'fontes' ? 'ativa' : ''} onClick={() => setAba('fontes')}>Por fonte/destino</button>
        </div>
      </section>

      {periodoValido && (aba === 'categorias' ? <PorCategoria periodo={periodo} /> : <PorFonteDestino periodo={periodo} />)}
    </>
  );
}
