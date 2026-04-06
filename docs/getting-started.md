# Getting Started

## Pré-requisitos

- **Node.js** >= 22.x
- **npm** >= 10.x
- **MongoDB** >= 7.x (local ou Atlas)
- Duas instâncias ou databases MongoDB: uma para dados principais, outra para imagens

---

## Variáveis de Ambiente

Copie `.env.example` para `.env` e preencha os valores. O servidor recusa inicializar se variáveis obrigatórias estiverem ausentes ou com valores inválidos (validação em `src/common/config/security.validation.ts`).

### Servidor

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `NODE_ENV` | Sim | — | `development` ou `production` |
| `PORT` | Não | `3000` | Porta HTTP da API |
| `ALLOWED_ORIGINS` | Sim | — | Origens permitidas no CORS, separadas por vírgula. **Não use `*` em produção.** |
| `TRUST_PROXY_HOPS` | Não | `0` | Número de proxies reversos à frente da API (para rate limiting por IP real) |

### Banco de Dados

| Variável | Obrigatória | Descrição |
|---|---|---|
| `MONGODB_URI` | Sim | URI de conexão MongoDB principal (estudantes, funcionários, licenças, audit) |
| `MONGODB_URI_IMAGE` | Sim | URI de conexão MongoDB para imagens (conexão separada nomeada `images`) |

### Sessão

| Variável | Obrigatória | Restrições | Descrição |
|---|---|---|---|
| `SERVICE_SECRET` | Sim | Mínimo 32 caracteres | Segredo compartilhado entre BFF e backend (usado nos endpoints de auth) |
| `SESSION_TTL_DAYS` | Sim | Inteiro positivo | Tempo de vida da sessão em dias |
| `BFF_STUDENT_URL` | Sim | URL válida | Origem do BFF de estudantes |
| `BFF_EMPLOYEE_URL` | Sim | URL válida | Origem do BFF de funcionários |

### OTP

| Variável | Obrigatória | Restrições | Descrição |
|---|---|---|---|
| `OTP_PEPPER` | Sim | Mínimo 16 caracteres | Segredo para HMAC-SHA256 dos códigos de verificação |

### E-mail

| Variável | Obrigatória | Padrão (exemplo) | Descrição |
|---|---|---|---|
| `MAIL_HOST` | Sim | `localhost` | Servidor SMTP |
| `MAIL_PORT` | Sim | `1025` | Porta SMTP |
| `MAIL_SECURE` | Não | `false` | TLS no SMTP (`true`/`false`) |
| `MAIL_USER` | Sim | — | Usuário SMTP |
| `MAIL_PASS` | Sim | — | Senha SMTP |
| `MAIL_FROM_NAME` | Não | `VRG Transport` | Nome exibido no remetente |

### API de Licenças (serviço externo)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `LICENSE_API_URL` | Sim | URL base do serviço externo de geração de carteirinhas |
| `LICENSE_API_KEY` | Sim | Chave de autenticação do serviço externo |
| `LICENSE_API_TIMEOUT_MS` | Não | Timeout em ms para chamadas ao serviço (padrão: `5000`) |

### APIs Externas (Sight)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `API_USER_SIGHT` | A confirmar | Usuário da API Sight |
| `API_KEY_SIGHT` | A confirmar | Chave da API Sight |

### Feature Flags

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `ENABLE_SWAGGER` | Não | `false` | Habilita o Swagger UI (só funciona com `NODE_ENV=development`) |

---

## Instalação

```bash
# Clonar o repositório
git clone https://github.com/VRGOrganization/vrg-transport-backend.git
cd vrg-transport-backend

# Instalar dependências
npm install

# Configurar ambiente
cp .env.example .env
# Edite .env com os valores corretos
```

---

## Executando

### Desenvolvimento

```bash
npm run start:dev
```

O NestJS iniciará com hot-reload. Logs de saída incluem a porta e se o Swagger está ativo.

### Produção

```bash
npm run build
npm run start:prod
```

### Docker

```bash
# Subir todos os serviços (API + MongoDB)
npm run docker:up

# Ver logs
npm run docker:logs

# Parar
npm run docker:down

# Reiniciar
npm run docker:restart
```

---

## Seed do Administrador

O sistema não expõe endpoint público para criar administradores. O primeiro admin deve ser criado via script:

```bash
npx ts-node scripts/seed-admin.ts
```

O script cria um usuário admin com as credenciais definidas em `ADMIN_SEED_USERNAME` e `ADMIN_SEED_PASSWORD` (ou valores padrão definidos no próprio script — verifique antes de rodar em produção).

---

## Acessando o Swagger

O Swagger está disponível **apenas em desenvolvimento** com `ENABLE_SWAGGER=true`:

```
http://localhost:3000/api/docs
```

Para autenticar no Swagger:
1. Faça login via `POST /api/v1/auth/student/login` (ou employee/admin) com `x-service-secret`
2. Copie o `sessionId` da resposta
3. Clique em **Authorize** no Swagger UI
4. Preencha `x-session-id` com o `sessionId`
5. Para endpoints do módulo Auth, preencha também `x-service-secret`

---

## Verificando a API

```bash
# Health check básico (requer sessão ADMIN)
curl -H "x-session-id: <session-id>" \
  http://localhost:3000/api/v1/license/health
```
