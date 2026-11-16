import { useId } from 'react';

// Input com rótulo e mensagem de erro junto ao campo (inclui erros devolvidos pela API).
export default function Campo({ rotulo, erro, ajuda, ...props }) {
  const id = useId();
  const idMsg = `${id}-msg`;
  return (
    <div className={`campo${erro ? ' campo--erro' : ''}`}>
      <label htmlFor={id}>{rotulo}</label>
      <input id={id} aria-invalid={Boolean(erro)} aria-describedby={erro || ajuda ? idMsg : undefined} {...props} />
      {(erro || ajuda) && (
        <small id={idMsg} className={erro ? 'campo__erro' : 'campo__ajuda'}>
          {erro || ajuda}
        </small>
      )}
    </div>
  );
}
