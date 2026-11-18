// Estados padrão de telas que consomem a API: carregando, erro e lista vazia.
export default function Estado({ carregando, erro, vazio, textoVazio, onTentar }) {
  if (carregando) return <p className="vazio" role="status">Carregando…</p>;
  if (erro) {
    return (
      <p className="aviso aviso--erro" role="alert">
        {erro}{' '}
        {onTentar && <button type="button" className="btn btn--discreto" onClick={onTentar}>Tentar de novo</button>}
      </p>
    );
  }
  if (vazio) return <p className="vazio">{textoVazio}</p>;
  return null;
}
