import { useId } from 'react';

// Select com rótulo e mensagem de erro junto ao campo (mesmo padrão do <Campo>).
export default function CampoSelect({ rotulo, erro, ajuda, children, ...props }) {
  const id = useId();
  const idMsg = `${id}-msg`;
  return (
    <div className={`campo${erro ? ' campo--erro' : ''}`}>
      <label htmlFor={id}>{rotulo}</label>
      <select id={id} aria-invalid={Boolean(erro)} aria-describedby={erro || ajuda ? idMsg : undefined} {...props}>
        {children}
      </select>
      {(erro || ajuda) && (
        <small id={idMsg} className={erro ? 'campo__erro' : 'campo__ajuda'}>{erro || ajuda}</small>
      )}
    </div>
  );
}
