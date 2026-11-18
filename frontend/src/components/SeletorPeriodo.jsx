import Campo from './Campo.jsx';

// Par de datas controlado pelo componente pai.
export default function SeletorPeriodo({ inicio, fim, onChange }) {
  return (
    <div className="grade-form">
      <Campo rotulo="De" type="date" value={inicio} onChange={(e) => onChange({ inicio: e.target.value, fim })} />
      <Campo rotulo="Até" type="date" value={fim} onChange={(e) => onChange({ inicio, fim: e.target.value })} />
    </div>
  );
}
