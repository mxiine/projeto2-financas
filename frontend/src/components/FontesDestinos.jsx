import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { formatarMoeda, mascaraValor, valorParaNumero } from '../services/formatadores.js';
import Campo from './Campo.jsx';
import CampoSelect from './CampoSelect.jsx';
import Estado from './Estado.jsx';

const ROTULOS = { renda: 'Renda', conta: 'Conta', cartao_credito: 'Cartão de crédito' };
const inicial = { nome: '', tipo: 'conta', diaFechamento: '', diaVencimento: '', limite: '' };

export default function FontesDestinos() {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState(inicial);
  const [editando, setEditando] = useState(null);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErroCarga('');
    try {
      const r = await api.get('/fontes-destinos');
      setLista(r.fontesDestinos ?? []);
    } catch (e) {
      setErroCarga(e.message);
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => { carregar(); }, []);

  const alterar = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: name === 'limite' ? mascaraValor(value) : value }));
  };

  function limpar() {
    setForm(inicial);
    setEditando(null);
    setErros({});
    setErroGeral('');
  }

  function editar(item) {
    setEditando(item.id);
    setSucesso('');
    setErros({});
    setErroGeral('');
    setForm({
      nome: item.nome,
      tipo: item.tipo,
      diaFechamento: item.diaFechamento ?? '',
      diaVencimento: item.diaVencimento ?? '',
      limite: item.limite != null ? mascaraValor(String(Math.round(Number(item.limite) * 100))) : '',
    });
  }

  async function salvar(e) {
    e.preventDefault();
    setSucesso('');
    setErroGeral('');

    const novos = {};
    if (!form.nome.trim()) novos.nome = 'Informe o nome.';
    const ehCartao = form.tipo === 'cartao_credito';
    if (ehCartao) {
      const f = Number(form.diaFechamento), v = Number(form.diaVencimento);
      if (!Number.isInteger(f) || f < 1 || f > 31) novos.diaFechamento = 'Informe um dia de 1 a 31.';
      if (!Number.isInteger(v) || v < 1 || v > 31) novos.diaVencimento = 'Informe um dia de 1 a 31.';
      if (valorParaNumero(form.limite) <= 0) novos.limite = 'Informe um limite maior que zero.';
    }
    setErros(novos);
    if (Object.keys(novos).length) return;

    const dados = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      ...(ehCartao && {
        diaFechamento: Number(form.diaFechamento),
        diaVencimento: Number(form.diaVencimento),
        limite: valorParaNumero(form.limite),
      }),
    };

    setSalvando(true);
    try {
      if (editando) await api.put(`/fontes-destinos/${editando}`, dados);
      else await api.post('/fontes-destinos', dados);
      setSucesso(editando ? 'Fonte/destino atualizado.' : 'Fonte/destino cadastrado.');
      limpar();
      await carregar();
    } catch (err) {
      setErros(err.campos ?? {});
      if (!err.campos || !Object.keys(err.campos).length) setErroGeral(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(item) {
    if (!window.confirm(`Excluir "${item.nome}"?`)) return;
    setSucesso('');
    setErroGeral('');
    try {
      await api.delete(`/fontes-destinos/${item.id}`);
      if (editando === item.id) limpar();
      setSucesso('Fonte/destino excluído.');
      await carregar();
    } catch (err) {
      setErroGeral(err.message); // ex.: 409 — existem lançamentos vinculados
    }
  }

  return (
    <>
      <header className="pagina__cab">
        <h1>Fontes e destinos</h1>
        <p>De onde o dinheiro vem e para onde ele vai: rendas, contas e cartões.</p>
      </header>

      {erroGeral && <p className="aviso aviso--erro" role="alert">{erroGeral}</p>}
      {sucesso && <p className="aviso aviso--ok" role="status">{sucesso}</p>}

      <section className="painel">
        <h2>{editando ? 'Editar fonte/destino' : 'Nova fonte/destino'}</h2>
        <form onSubmit={salvar} noValidate className="grade-form">
          <Campo rotulo="Nome" name="nome" value={form.nome} onChange={alterar} erro={erros.nome} maxLength={60} />
          <CampoSelect rotulo="Tipo" name="tipo" value={form.tipo} onChange={alterar} erro={erros.tipo}>
            {Object.entries(ROTULOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </CampoSelect>
          {form.tipo === 'cartao_credito' && (
            <>
              <Campo rotulo="Dia de fechamento" name="diaFechamento" type="number" min="1" max="31"
                     value={form.diaFechamento} onChange={alterar} erro={erros.diaFechamento} />
              <Campo rotulo="Dia de vencimento" name="diaVencimento" type="number" min="1" max="31"
                     value={form.diaVencimento} onChange={alterar} erro={erros.diaVencimento} />
              <Campo rotulo="Limite (R$)" name="limite" inputMode="numeric" placeholder="0,00"
                     value={form.limite} onChange={alterar} erro={erros.limite} />
            </>
          )}
          <div className="acoes-form">
            <button className="btn btn--solido" disabled={salvando}>{salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Cadastrar'}</button>
            {editando && <button type="button" className="btn btn--discreto" onClick={limpar}>Cancelar</button>}
          </div>
        </form>
      </section>

      <section className="painel">
        <h2>Meus cadastros</h2>
        <Estado carregando={carregando} erro={erroCarga} vazio={!lista.length} textoVazio="Nenhuma fonte/destino cadastrado." onTentar={carregar} />
        {!carregando && !erroCarga && lista.length > 0 && (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr><th>Nome</th><th>Tipo</th><th>Fecha / vence</th><th className="num">Limite</th><th /></tr>
              </thead>
              <tbody>
                {lista.map((i) => (
                  <tr key={i.id}>
                    <td>{i.nome}</td>
                    <td>{ROTULOS[i.tipo]}</td>
                    <td>{i.tipo === 'cartao_credito' ? `dia ${i.diaFechamento} / dia ${i.diaVencimento}` : '—'}</td>
                    <td className="num">{i.tipo === 'cartao_credito' ? formatarMoeda(i.limite) : '—'}</td>
                    <td className="acoes">
                      <button className="btn btn--discreto" onClick={() => editar(i)}>Editar</button>
                      <button className="btn btn--perigo" onClick={() => excluir(i)}>Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
