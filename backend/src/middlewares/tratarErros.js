export function tratarErros(erro, req, res, next) {
    console.error(erro);

    if (erro.type === 'entity.too.large') {
        return res.status(413).json({
            erro: 'O conteúdo enviado ultrapassa o limite permitido.'
        });
    }

    return res.status(500).json({
        erro: 'Erro interno do servidor.'
    });
}