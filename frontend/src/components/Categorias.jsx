
import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

export default function Categorias() {
  const [categorias, setCategorias] = useState([]);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('saida');
  const [editando, setEditando] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  async function carregarCategorias() {
    try {
      setErro('');
      const resposta = await api.get('/categorias');

      const lista = Array.isArray(resposta)
        ? resposta
        : resposta.categorias ?? [];

      setCategorias(lista);
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarCategorias();
  }, []);

  function limparFormulario() {
    setNome('');
    setTipo('saida');
    setEditando(null);
  }

  async function salvarCategoria(event) {
    event.preventDefault();
    setErro('');
    setSucesso('');

    try {
      const dados = {
        nome: nome.trim(),
        tipo
      };

      if (editando !== null) {
        await api.put(`/categorias/${editando}`, dados);
        setSucesso('Categoria atualizada com sucesso!');
      } else {
        await api.post('/categorias', dados);
        setSucesso('Categoria cadastrada com sucesso!');
      }

      limparFormulario();
      await carregarCategorias();
    } catch (error) {
      setErro(error.message);
    }
  }

  function prepararEdicao(categoria) {
    setEditando(categoria.id);
    setNome(categoria.nome);
    setTipo(categoria.tipo);
    setErro('');
    setSucesso('');
  }

  async function excluirCategoria(id) {
    const confirmar = window.confirm(
      'Tem certeza que deseja excluir esta categoria?'
    );

    if (!confirmar) return;

    setErro('');
    setSucesso('');

    try {
      await api.delete(`/categorias/${id}`);
      setSucesso('Categoria excluída com sucesso!');

      if (editando === id) {
        limparFormulario();
      }

      await carregarCategorias();
    } catch (error) {
      setErro(error.message);
    }
  }

  const entradas = categorias.filter(
    (categoria) => categoria.tipo === 'entrada'
  );

  const saidas = categorias.filter(
    (categoria) => categoria.tipo === 'saida'
  );

  function renderizarLista(lista) {
    if (lista.length === 0) {
      return <p>Nenhuma categoria cadastrada.</p>;
    }

    return (
      <div className="categorias-lista">
        {lista.map((categoria) => (
          <div className="categoria-item" key={categoria.id}>
            <span>{categoria.nome}</span>

            <div className="categoria-acoes">
              <button
                type="button"
                onClick={() => prepararEdicao(categoria)}
              >
                Editar
              </button>

              <button
                type="button"
                onClick={() => excluirCategoria(categoria.id)}
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <main className="pagina-categorias">
      <h1>Categorias</h1>
      <p>Organize suas entradas e despesas.</p>

      {erro && <div className="mensagem erro">{erro}</div>}
      {sucesso && <div className="mensagem sucesso">{sucesso}</div>}

      <section className="categoria-painel">
        <h2>
          {editando !== null ? 'Editar categoria' : 'Nova categoria'}
        </h2>

        <form onSubmit={salvarCategoria}>
          <label htmlFor="nome-categoria">Nome</label>
          <input
            id="nome-categoria"
            type="text"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Ex.: Alimentação"
            maxLength={60}
            required
          />

          <label htmlFor="tipo-categoria">Tipo</label>
          <select
            id="tipo-categoria"
            value={tipo}
            onChange={(event) => setTipo(event.target.value)}
          >
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
          </select>

          <div className="categoria-botoes">
            <button type="submit">
              {editando !== null ? 'Salvar alterações' : 'Cadastrar categoria'}
            </button>

            {editando !== null && (
              <button type="button" onClick={limparFormulario}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      {carregando ? (
        <p>Carregando categorias...</p>
      ) : (
        <div className="categorias-colunas">
          <section className="categoria-painel">
            <h2>Entradas</h2>
            {renderizarLista(entradas)}
          </section>

          <section className="categoria-painel">
            <h2>Saídas</h2>
            {renderizarLista(saidas)}
          </section>
        </div>
      )}
    </main>
  );
}
