# Controle Financeiro Pessoal

**Projeto acadêmico — Programação Web Full Stack**  
**Autoras:** Maxine Lourenço da Silva e Maria Carolyne Nogueira

Aplicação web full stack para controle financeiro pessoal. O sistema permite que cada pessoa registre entradas e saídas, organize suas movimentações por categorias e fontes/destinos, acompanhe resumos financeiros e consulte relatórios e previsões de faturas de cartão de crédito.

## Funcionalidades

- Cadastro de usuários com validação de e-mail, CPF e senha.
- Login com autenticação JWT e proteção das rotas privadas.
- Criação automática de categorias padrão e de uma conta corrente no cadastro.
- Gerenciamento de categorias de entrada e saída.
- Gerenciamento de fontes e destinos: rendas, contas e cartões de crédito.
- Cadastro, consulta, edição e exclusão de lançamentos.
- Filtros por período, tipo, categoria e fonte/destino, com paginação e totais.
- Registro de compras parceladas, com distribuição dos valores em centavos.
- Dashboard com resumo de entradas, saídas e saldo.
- Relatórios por categoria e por fonte/destino.
- Previsão de faturas de cartão de crédito.
- Página de saúde financeira com indicadores, projeção e dicas calculadas a partir dos dados do usuário.

## Tecnologias utilizadas

### Frontend

- React
- Vite
- React Router DOM
- Recharts para gráficos
- Fetch API para comunicação com o backend

### Backend

- Node.js
- Express
- MySQL
- mysql2 (pool de conexões)
- bcrypt para hash de senhas
- jsonwebtoken para autenticação JWT
- express-rate-limit para limitar tentativas de login
- dotenv para variáveis de ambiente

## Requisitos para executar o projeto

- Node.js e npm instalados.
- MySQL Server instalado e em execução.
- MySQL Workbench (opcional, recomendado para administrar e consultar o banco).
- Git (opcional, para clonar e versionar o repositório).

## Configuração do banco de dados

1. Inicie o serviço do MySQL Server no computador.
2. Na pasta `backend`, crie um arquivo `.env` a partir do modelo `.env.example`.

No Windows (Prompt de Comando):

```cmd
copy .env.example .env
```

No PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Abra `backend/.env` e informe as credenciais da sua instalação do MySQL. Exemplo:

```env
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sua_senha_mysql
DB_NAME=financas_db

JWT_SECRET=coloque_uma_chave_secreta_longa_e_aleatoria
FRONTEND_URL=http://localhost:5174

# Opcional: senha das contas criadas pelo seed.js
SEED_DEMO_PASSWORD=Demo1234!
```

Substitua `sua_senha_mysql` pela senha do usuário MySQL utilizado no seu ambiente. Defina um `JWT_SECRET` próprio e longo. Não compartilhe o arquivo `.env` nem publique suas credenciais.

4. Instale as dependências do backend e inicialize a estrutura do banco:

```bash
cd backend
npm install
npm run db:init
```

O comando `npm run db:init` cria o banco configurado em `DB_NAME`, caso ainda não exista, e executa os comandos do arquivo `database/schema.sql`. As tabelas existentes não são apagadas. Esse script não atualiza automaticamente tabelas já existentes caso o schema tenha sido alterado; mudanças posteriores na estrutura devem ser aplicadas como alterações SQL próprias.

5. Para inserir os dados de demonstração, execute:

```bash
npm run seed
```

O seed prepara dois usuários de demonstração, categorias, fontes/destinos e movimentações distribuídas pelos três meses mais recentes, incluindo uma compra parcelada. Ele pode ser executado novamente sem duplicar os lançamentos de demonstração que já foram inseridos.

### Contas de demonstração

| Usuário | E-mail | Senha padrão |
|---|---|---|
| Ana Demonstração | `ana@financas.demo` | `Demo1234!` |
| Bruno Demonstração | `bruno@financas.demo` | `Demo1234!` |

A senha pode ser alterada pela variável `SEED_DEMO_PASSWORD` no `.env`. As contas são destinadas a testes locais e demonstrações acadêmicas; não utilize essas credenciais em produção.

## Executar a aplicação

O backend e o frontend devem permanecer em execução em terminais separados.

### 1. Backend

Na pasta `backend`:

```bash
npm run dev
```

O servidor será iniciado em:

```text
http://localhost:3000
```

Para conferir a API e a conexão com o MySQL, acesse:

```text
http://localhost:3000/api/health
```

A resposta esperada indica que a API está online e o banco está conectado.

### 2. Frontend

Abra outro terminal e entre na pasta `frontend`:

```bash
cd frontend
npm install
```

Os componentes de relatórios e saúde financeira utilizam Recharts. Caso a dependência ainda não esteja declarada no `package.json`, instale-a com:

```bash
npm install recharts
```

Depois inicie o Vite:

```bash
npm run dev
```

O endereço configurado no projeto é:

```text
http://localhost:5174
```

Se a porta ou endereço do backend forem alterados, ajuste `FRONTEND_URL` no `.env` do backend. O frontend permite configurar a URL da API pela variável `VITE_API_URL`; sem ela, utiliza `http://localhost:3000/api`.

## Scripts disponíveis

### Backend (`backend/package.json`)

| Comando | Descrição |
|---|---|
| `npm install` | Instala as dependências do backend. |
| `npm run db:init` | Cria o banco e as tabelas definidas em `database/schema.sql`, se ainda não existirem. |
| `npm run seed` | Insere os dados de demonstração. |
| `npm run dev` | Inicia o backend com Nodemon. |
| `npm start` | Inicia o backend sem Nodemon. |
| `npm test` | Executa os testes automatizados das regras financeiras. |

### Frontend (`frontend/package.json`)

| Comando | Descrição |
|---|---|
| `npm install` | Instala as dependências do frontend. |
| `npm run dev` | Inicia o servidor de desenvolvimento do Vite. |
| `npm run build` | Gera a versão de produção em `frontend/dist`. |
| `npm run preview` | Executa uma prévia local da versão compilada. |

## Rotas da API

O endereço-base da API é `http://localhost:3000/api`. As rotas de cadastro e login são públicas. As demais rotas de dados exigem autenticação por JWT no cabeçalho:

```http
Authorization: Bearer <token>
```

### Saúde da API

| Método | Rota | Descrição | Autenticação |
|---|---|---|---|
| GET | `/health` | Verifica a API e a conexão com MySQL. | Não |

### Autenticação

| Método | Rota | Descrição | Autenticação |
|---|---|---|---|
| POST | `/auth/cadastro` | Cadastra usuário e cria dados padrão. | Não |
| POST | `/auth/login` | Autentica e retorna o JWT. | Não |
| GET | `/auth/me` | Retorna os dados do usuário autenticado. | Sim |

### Categorias

| Método | Rota | Descrição |
|---|---|---|
| GET | `/categorias` | Lista as categorias do usuário. |
| POST | `/categorias` | Cria uma categoria. |
| PUT | `/categorias/:id` | Atualiza uma categoria. |
| DELETE | `/categorias/:id` | Exclui uma categoria quando não possui lançamentos associados. |

### Fontes e destinos

| Método | Rota | Descrição |
|---|---|---|
| GET | `/fontes-destinos` | Lista fontes e destinos do usuário. |
| POST | `/fontes-destinos` | Cria uma fonte ou destino. |
| PUT | `/fontes-destinos/:id` | Atualiza uma fonte ou destino. |
| DELETE | `/fontes-destinos/:id` | Exclui uma fonte/destino quando não possui lançamentos associados. |

### Lançamentos

| Método | Rota | Descrição |
|---|---|---|
| GET | `/lancamentos` | Lista lançamentos com filtros e paginação, além dos totais do período. |
| GET | `/lancamentos/:id` | Consulta um lançamento específico. |
| POST | `/lancamentos` | Cria um lançamento ou uma compra parcelada. |
| PUT | `/lancamentos/:id` | Atualiza um lançamento. |
| DELETE | `/lancamentos/:id` | Exclui um lançamento; aceita `?todasParcelas=true` para excluir o grupo de parcelas. |

Parâmetros disponíveis na listagem de lançamentos: `inicio`, `fim`, `tipo`, `categoriaId`, `fonteDestinoId`, `pagina` e `porPagina`.

### Relatórios e faturas

| Método | Rota | Descrição |
|---|---|---|
| GET | `/relatorios/categorias?inicio=AAAA-MM-DD&fim=AAAA-MM-DD` | Relatório de entradas e saídas por categoria e comparação com período anterior. |
| GET | `/relatorios/fontes-destinos?inicio=AAAA-MM-DD&fim=AAAA-MM-DD` | Entradas, saídas e saldo por fonte/destino. |
| GET | `/relatorios/faturas?meses=3` | Fatura atual e previsão das próximas faturas. |

### Saúde financeira

| Método | Rota | Descrição |
|---|---|---|
| GET | `/saude-financeira` | Retorna indicadores, projeção e dicas calculadas com os dados do usuário. |

Todas as rotas de categorias, fontes/destinos, lançamentos, relatórios e saúde financeira são protegidas por JWT e devem limitar as consultas ao usuário autenticado.

## Testes e validação

Para executar os testes automatizados das regras financeiras, na pasta `backend`:

```bash
npm test
```

Para verificar a compilação do frontend, na pasta `frontend`:

```bash
npm run build
```

Também é recomendado testar as rotas pelo Insomnia ou Postman, incluindo cadastro, tentativa de e-mail/CPF duplicados, login, acesso sem token, isolamento entre dois usuários, CRUDs, compra parcelada e previsão de faturas.

## Segurança e cuidados

- O arquivo `backend/.env` contém credenciais locais e não deve ser versionado.
- O arquivo `backend/.env.example` deve ser mantido no repositório como modelo de configuração, sem credenciais reais.
- As senhas dos usuários são armazenadas com hash usando bcrypt.
- As rotas privadas utilizam JWT.
- As consultas ao MySQL devem utilizar parâmetros preparados.
- O backend deve obter o identificador do usuário a partir do token, e não confiar em `usuario_id` enviado pelo frontend.
- Os dados e as contas incluídos pelo seed são apenas para demonstração local.

## Autoria

Projeto desenvolvido por **Maxine Lourenço da Silva** e **Maria Carolyne Nogueira**, para a disciplina de Programação Web Full Stack.
