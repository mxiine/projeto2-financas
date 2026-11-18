import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';
import { formatarMoeda, formatarData, mascaraValor, valorParaNumero, mesCorrente } from '../services/formatadores.js';
import Campo from './Campo.jsx';
import CampoSelect from './CampoSelect.jsx';
import Estado from './Estado.jsx';

const hojeISO = () => {
  const h = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${h.getFullYear()}-${p(h.getMonth() + 1)}-${p(h.getDate())}`;
};

const formVazio = () => ({
  tipo: 'saida', descricao: '', valor: '', data: hojeISO(), categoriaId: '', fonteDestinoId: '', totalParcelas: '1',
});

export default function Lancamentos() {
  const periodo = mesCorrente();
  const [filtros, setFiltros] = useState({ inicio: periodo.inicio, fim: periodo.fim, tipo: '', categoriaId: '', fonteDestinoId: '' });
  const [pagina, setPagina] = useState(1);

  const [dados, setDados] = useState({ lancamentos: [], totais: { entradas: 0, saidas: 0, saldo: 0 }, paginacao: { pagina: 1, totalPaginas: 0, total: 0 } });
  const [categorias, setCategorias] = useState([]);
  const [fontes, setFontes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState('');

  const [form, setForm] = useState(formVazio);
  const [editando, setEditando] = useState(null); // lançamento em edição
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [paraExcluir, setParaExcluir] = useState(null);

  // categorias e fontes carregam uma vez; a listagem recarrega ao mudar filtros/página
  useEffect(() => {
    Promise.all([api.get('/categorias'), api.get('/fontes-destinos')])
      .then(([c, f]) => { setCategorias(c.categorias ?? []); setFontes(f.fontesDestinos ?? []); })
      .catch((e) => setErroCarga(e.message));
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroCarga('');
    try {
      setDados(await api.get('/lancamentos', { ...filtros, pagina, porPagina: 10 }));
    } catch (e) {
      setErroCarga(e.message);
    } finally {
      setCarregando(false);
    }
  }, [filtros, pagina]);
  useEffect(() => { carregar(); }, [carregar]);

  const alterarFiltro = (e) => { setPagina(1); setFiltros((f) => ({ ...f, [e.target.name]: e.target.value })); };

  const fonteSelecionada = fontes.find((f) => String(f.id) === String(form.fonteDestinoId));
  const parcelavel = form.tipo === 'saida' && fonteSelecionada?.tipo === 'cartao_credito' && !editando;
  const categoriasDoTipo = useMemo(() => categorias.filter((c) => c.tipo === form.tipo), [categorias, form.tipo]);
  const fontesDoTipo = useMemo(
    () => fontes.filter((f) => (form.tipo === 'entrada' ? f.tipo !== 'cartao_credito' : f.tipo !== 'renda')),
    [fontes, form.tipo]
  );

  const alterar = (e) => {
    const { name, value } = e.target;
    setForm((f) => {
      const novo = { ...f, [name]: name === 'valor' ? mascaraValor(value) : value };
      if (name === 'tipo') { novo.categoriaId = ''; novo.fonteDestinoId = ''; novo.totalParcelas = '1'; }
      if (name === 'fonteDestinoId') novo.totalParcelas = '1';
      return novo;
    });
  };

  function limpar() {
    setForm(formVazio());
    setEditando(null);
    setErros({});
    setErroGeral('');
  }

  function iniciarEdicao(l) {
    setEditando(l);
    setSucesso('');
    setErros({});
    setErroGeral('');
    setForm({
      tipo: l.tipo, descricao: l.descricao, valor: mascaraValor(String(Math.round(l.valor * 100))), data: l.data,
      categoriaId: String(l.categoriaId), fonteDestinoId: String(l.fonteDestinoId), totalParcelas: String(l.totalParcelas),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function salvar(e) {
    e.preventDefault();
    setSucesso('');
    setErroGeral('');

    const novos = {};
    if (!form.descricao.trim()) novos.descricao = 'Informe a descrição.';
    if (valorParaNumero(form.valor) <= 0) novos.valor = 'O valor deve ser maior que zero.';
    if (!form.data) novos.data = 'Informe a data.';
    if (!form.categoriaId) novos.categoriaId = 'Selecione uma categoria.';
    if (!form.fonteDestinoId) novos.fonteDestinoId = 'Selecione a fonte/destino.';
    const parcelas = Number(form.totalParcelas);
    if (parcelavel && (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 48)) novos.totalParcelas = 'Use de 1 a 48 parcelas.';
    setErros(novos);
    if (Object.keys(novos).length) return;

    const corpo = {
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      valor: valorParaNumero(form.valor),
      data: form.data,
      categoriaId: Number(form.categoriaId),
      fonteDestinoId: Number(form.fonteDestinoId),
      ...(parcelavel && { totalParcelas: parcelas }),
    };

    setSalvando(true);
    try {
      if (editando) {
        await api.put(`/lancamentos/${editando.id}`, corpo);
        setSucesso('Lançamento atualizado.');
      } else {
        const r = await api.post('/lancamentos', corpo);
        setSucesso(r.mensagem);
      }
      limpar();
      await carregar();
    } catch (err) {
      setErros(err.campos ?? {});
      if (!err.campos || !Object.keys(err.campos).length) setErroGeral(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao(todasParcelas) {
    const alvo = paraExcluir;
    setParaExcluir(null);
    setSucesso('');
    setErroGeral('');
    try {
      await api.delete(`/lancamentos/${alvo.id}`, todasParcelas ? { todasParcelas: 'true' } : undefined);
      setSucesso(todasParcelas ? 'Todas as parcelas foram excluídas.' : 'Lançamento excluído.');
      if (editando?.id === alvo.id) limpar();
      if (dados.lancamentos.length === 1 && pagina > 1) setPagina(pagina - 1);
      else await carregar();
    } catch (err) {
      setErroGeral(err.message);
    }
  }

  const { totais, paginacao } = dados;

  return (
    <>
      <header className="pagina__cab">
        <h1>Lançamentos</h1>
        <p>Registre suas entradas e saídas, inclusive compras parceladas no cartão.</p>
      </header>

      {erroGeral && <p className="aviso aviso--erro" role="alert">{erroGeral}</p>}
      {sucesso && <p className="aviso aviso--ok" role="status">{sucesso}</p>}

      <section className="painel">
        <h2>{editando ? `Editar lançamento${editando.totalParcelas > 1 ? ` (parcela ${editando.parcelaAtual}/${editando.totalParcelas})` : ''}` : 'Novo lançamento'}</h2>
        <form onSubmit={salvar} noValidate className="grade-form">
          <CampoSelect rotulo="Tipo" name="tipo" value={form.tipo} onChange={alterar} erro={erros.tipo}>
            <option value="saida">Saída</option>
            <option value="entrada">Entrada</option>
          </CampoSelect>
          <Campo rotulo="Descrição" name="descricao" value={form.descricao} onChange={alterar} erro={erros.descricao} maxLength={120} />
          <Campo rotulo="Valor (R$)" name="valor" inputMode="numeric" placeholder="0,00" value={form.valor} onChange={alterar} erro={erros.valor}
                 ajuda={parcelavel && Number(form.totalParcelas) > 1 ? 'Valor total da compra; será dividido entre as parcelas.' : undefined} />
          <Campo rotulo="Data" name="data" type="date" value={form.data} onChange={alterar} erro={erros.data} />
          <CampoSelect rotulo="Categoria" name="categoriaId" value={form.categoriaId} onChange={alterar} erro={erros.categoriaId}>
            <option value="">Selecione…</option>
            {categoriasDoTipo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </CampoSelect>
          <CampoSelect rotulo={form.tipo === 'entrada' ? 'Fonte' : 'Destino'} name="fonteDestinoId" value={form.fonteDestinoId} onChange={alterar} erro={erros.fonteDestinoId}>
            <option value="">Selecione…</option>
            {fontesDoTipo.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </CampoSelect>
          {parcelavel && (
            <Campo rotulo="Parcelas" name="totalParcelas" type="number" min="1" max="48" value={form.totalParcelas} onChange={alterar} erro={erros.totalParcelas} />
          )}
          {erros.totalParcelas && !parcelavel && <p className="campo__erro">{erros.totalParcelas}</p>}
          <div className="acoes-form">
            <button className="btn btn--solido" disabled={salvando}>{salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Adicionar'}</button>
            {editando && <button type="button" className="btn btn--discreto" onClick={limpar}>Cancelar</button>}
          </div>
        </form>
        {editando?.totalParcelas > 1 && (
          <p className="campo__ajuda">A edição altera somente esta parcela. O parcelamento não pode ser alterado.</p>
        )}
      </section>

      <section className="painel">
        <h2>Filtros</h2>
        <div className="grade-form">
          <Campo rotulo="De" name="inicio" type="date" value={filtros.inicio} onChange={alterarFiltro} />
          <Campo rotulo="Até" name="fim" type="date" value={filtros.fim} onChange={alterarFiltro} />
          <CampoSelect rotulo="Tipo" name="tipo" value={filtros.tipo} onChange={alterarFiltro}>
            <option value="">Todos</option>
            <option value="entrada">Entradas</option>
            <option value="saida">Saídas</option>
          </CampoSelect>
          <CampoSelect rotulo="Categoria" name="categoriaId" value={filtros.categoriaId} onChange={alterarFiltro}>
            <option value="">Todas</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.tipo === 'entrada' ? 'entrada' : 'saída'})</option>)}
          </CampoSelect>
          <CampoSelect rotulo="Fonte/destino" name="fonteDestinoId" value={filtros.fonteDestinoId} onChange={alterarFiltro}>
            <option value="">Todos</option>
            {fontes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </CampoSelect>
        </div>
      </section>

      <section className="resumo" aria-label="Totais do período">
        <div className="resumo__item"><span>Entradas</span><strong className="valor valor--entrada">{formatarMoeda(totais.entradas)}</strong></div>
        <div className="resumo__item"><span>Saídas</span><strong className="valor valor--saida">{formatarMoeda(totais.saidas)}</strong></div>
        <div className="resumo__item resumo__item--saldo"><span>Saldo</span><strong className="valor">{formatarMoeda(totais.saldo)}</strong></div>
      </section>

      <section className="painel">
        <Estado carregando={carregando} erro={erroCarga} vazio={!dados.lancamentos.length} textoVazio="Nenhum lançamento encontrado neste período." onTentar={carregar} />
        {!carregando && !erroCarga && dados.lancamentos.length > 0 && (
          <>
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Fonte/destino</th><th className="num">Valor</th><th /></tr>
                </thead>
                <tbody>
                  {dados.lancamentos.map((l) => (
                    <tr key={l.id}>
                      <td>{formatarData(l.data)}</td>
                      <td>
                        {l.descricao}
                        {l.totalParcelas > 1 && <span className="selo">{l.parcelaAtual}/{l.totalParcelas}</span>}
                      </td>
                      <td>{l.categoria}</td>
                      <td>{l.fonteDestino}</td>
                      <td className={`num valor--${l.tipo}`}>{l.tipo === 'entrada' ? '+' : '−'} {formatarMoeda(l.valor)}</td>
                      <td className="acoes">
                        <button className="btn btn--discreto" onClick={() => iniciarEdicao(l)}>Editar</button>
                        <button className="btn btn--perigo" onClick={() => setParaExcluir(l)}>Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav className="paginacao" aria-label="Paginação">
              <button className="btn btn--discreto" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
              <span>Página {paginacao.pagina} de {paginacao.totalPaginas} · {paginacao.total} lançamento(s)</span>
              <button className="btn btn--discreto" disabled={pagina >= paginacao.totalPaginas} onClick={() => setPagina(pagina + 1)}>Próxima</button>
            </nav>
          </>
        )}
      </section>

      {paraExcluir && (
        <div className="modal-fundo" role="presentation" onClick={() => setParaExcluir(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-exclusao" onClick={(e) => e.stopPropagation()}>
            <h2 id="titulo-exclusao">Excluir lançamento</h2>
            <p>
              {paraExcluir.totalParcelas > 1
                ? `"${paraExcluir.descricao}" é uma compra parcelada (parcela ${paraExcluir.parcelaAtual}/${paraExcluir.totalParcelas}). O que deseja excluir?`
                : `Excluir "${paraExcluir.descricao}" (${formatarMoeda(paraExcluir.valor)})?`}
            </p>
            <div className="acoes-form">
              <button className="btn btn--perigo" onClick={() => confirmarExclusao(false)}>
                {paraExcluir.totalParcelas > 1 ? 'Somente esta parcela' : 'Excluir'}
              </button>
              {paraExcluir.totalParcelas > 1 && (
                <button className="btn btn--perigo" onClick={() => confirmarExclusao(true)}>Todas as parcelas</button>
              )}
              <button className="btn btn--discreto" onClick={() => setParaExcluir(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
