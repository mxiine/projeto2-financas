// Erro de negócio/validação lançado pelas rotas e models; o middleware o converte
// no padrão único { erro, campos } definido no enunciado.
export class ErroHttp extends Error {
  constructor(status, erro, campos) {
    super(erro);
    this.status = status;
    this.campos = campos;
  }
}

export function tratarErros(erro, req, res, next) {
  if (res.headersSent) return next(erro);

  if (erro instanceof ErroHttp) {
    const corpo = { erro: erro.message };
    if (erro.campos && Object.keys(erro.campos).length) corpo.campos = erro.campos;
    return res.status(erro.status).json(corpo);
  }

  if (erro.type === 'entity.too.large') {
    return res.status(413).json({ erro: 'O conteúdo enviado ultrapassa o limite permitido.' });
  }

  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.' });
  }

  if (erro.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ erro: 'Já existe um registro com estes dados.' });
  }

  if (erro.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({ erro: 'Não é possível excluir: existem registros vinculados.' });
  }

  console.error(erro);
  return res.status(500).json({ erro: 'Erro interno do servidor.' });
}
