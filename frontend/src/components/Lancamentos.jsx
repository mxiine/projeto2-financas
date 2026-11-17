
import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

export default function Lancamentos() {
  const [lancamentos, setLancamentos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [fontesDestinos, setFontesDestinos] = useState([]);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');

  const [inicio, setInicio] = useState(`${ano}-${mes}-01`);
  const [fim, setFim] = useState(
    `${ano}-${mes}-${new Date(ano, hoje.getMonth() + 1, 0).getDate()}`
  );

  async function carregarDados() {
    try {
      setErro('');
      setCarregando(true);

      const [respostaLancamentos, respostaCategorias, respostaFontes] =
        await Promise.all([
          api.get(`/lancamentos?inicio=${inicio}&fim=${fim}`),
          api.get('/categorias'),
          api.get('/fontes-destinos'),
        ]);

      setLancamentos(respostaLancamentos.lancamentos ?? []);
      setCategorias(respostaCategorias.categorias ?? []);
      setFontesDestinos(respostaFontes.fontesDestinos ?? []);

    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  function formatarValor(valor) {
    return Number(valor).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  function formatarData(data) {
    return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR');
  }

  return (
    <main className="pagina-lancamentos">
      <h1>Lançamentos</h1>
      <p>Gerencie suas entradas e despesas.</p>

      {erro && <div className="mensagem erro">{erro}</div>}

      <section className="lancamento-painel">
        <h2>Filtrar lançamentos</h2>

        <div>
          <label htmlFor="inicio">Data inicial</label>
          <input
            id="inicio"
            type="date"
            value={inicio}
            onChange={(event) => setInicio(event.target.value)}
          />

          <label htmlFor="fim">Data final</label>
          <input
            id="fim"
            type="date"
            value={fim}
            onChange={(event) => setFim(event.target.value)}
          />

          <button type="button" onClick={carregarDados}>
            Filtrar
          </button>
        </div>
      </section>

      <section className="lancamento-painel">
        <h2>Meus lançamentos</h2>

        {carregando ? (
          <p>Carregando lançamentos...</p>
        ) : lancamentos.length === 0 ? (
          <p>Nenhum lançamento encontrado nesse período.</p>
        ) : (
          <div className="lancamentos-lista">
            {lancamentos.map((lancamento) => (
              <div className="lancamento-item" key={lancamento.id}>
                <div>
                  <strong>{lancamento.descricao}</strong>
                  <p>{lancamento.categoria}</p>
                  <small>{formatarData(lancamento.data)}</small>
                </div>

                <div>
                  <strong>
                    {lancamento.tipo === 'entrada' ? '+' : '-'}
                    {formatarValor(lancamento.valor)}
                  </strong>
                  <p>{lancamento.fonteDestino}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
