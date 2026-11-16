// Validações do cliente (complementares: a validação oficial é a do servidor).

export function cpfValido(cpf) {
  const d = String(cpf).replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (tamanho) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

export const emailValido = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());

export const senhaValida = (senha) =>
  senha.length >= 8 && /[A-Za-z]/.test(senha) && /\d/.test(senha);

export function validarCadastro({ nome, email, cpf, senha, confirmacao }) {
  const erros = {};
  if (!nome.trim()) erros.nome = 'Informe seu nome.';
  if (!email.trim()) erros.email = 'Informe seu e-mail.';
  else if (!emailValido(email)) erros.email = 'Informe um e-mail válido.';
  if (!cpf.trim()) erros.cpf = 'Informe seu CPF.';
  else if (!cpfValido(cpf)) erros.cpf = 'CPF inválido. Confira os números.';
  if (!senha) erros.senha = 'Crie uma senha.';
  else if (!senhaValida(senha)) erros.senha = 'Use no mínimo 8 caracteres, com letras e números.';
  if (!confirmacao) erros.confirmacao = 'Repita a senha.';
  else if (confirmacao !== senha) erros.confirmacao = 'As senhas não são iguais.';
  return erros;
}
