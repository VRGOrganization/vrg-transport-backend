# Getting Started

## Pré-requisitos

- Node.js 22+
- npm 10+
- MongoDB 7+
- Docker (opcional para ambiente local)

## Instalação

```bash
npm install
```

## Variáveis de ambiente

Copie `.env.example` para `.env`.

```bash
cp .env.example .env
```

A API valida configuração no bootstrap (`validateSecurityConfig`) e falha ao iniciar se chaves obrigatórias estiverem ausentes.

### Obrigatórias

| Variável | Descrição |
|---|---|
| `SERVICE_SECRET` | Segredo compartilhado BFF <-> backend (mín. 32 chars) |
| `SESSION_TTL_STUDENT_DAYS` ou `SESSION_TTL_DAYS` | TTL de sessão para estudante |
| `SESSION_TTL_STAFF_DAYS` ou `SESSION_TTL_DAYS` | TTL de sessão para funcionário/admin |
| `ALLOWED_ORIGINS` | Lista CSV de origens permitidas no CORS (sem `*`) |
| `MONGODB_URI` | Conexão Mongo principal |
| `MONGODB_URI_IMAGE` | Conexão Mongo de imagens |
| `OTP_PEPPER` | Segredo OTP (mín. 16 chars) |
| `CPF_HMAC_SECRET` | Segredo para hash de CPF (mín. 16 chars) |
| `LICENSE_API_URL` | URL do serviço externo de emissão |
| `LICENSE_API_KEY` | Chave da API externa de emissão |
| `QR_CODE_BASE_URL` | URL base usada no QR code de verificação |
| `BREVO_API_KEY` | API key da Brevo |
| `MAIL_FROM_ADDRESS` | E-mail remetente |

### Opcionais relevantes

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3000` | Porta HTTP |
| `NODE_ENV` | `development` | Ambiente |
| `MAIL_FROM_NAME` | `VRG Transport` | Nome do remetente |
| `LICENSE_API_TIMEOUT_MS` | `5000` | Timeout da chamada externa de licença |
| `ENABLE_SWAGGER` | `false` | Habilita Swagger (apenas fora de produção) |
| `TRUST_PROXY_HOPS` | `1` | Número de hops de proxy para IP real |

### Chaves presentes no `.env.example` mas não utilizadas no runtime atual

- `BFF_STUDENT_URL`
- `BFF_EMPLOYEE_URL`
- `API_USER_SIGHT`
- `API_KEY_SIGHT`

## Execução

### Desenvolvimento

```bash
npm run start:dev
```

### Produção

```bash
npm run build
npm run start:prod
```

### Docker

```bash
npm run docker:up
npm run docker:logs
npm run docker:down
```

## Seed de admin

```bash
npm run seed:admin
```

## Swagger

Disponível apenas quando:

- `ENABLE_SWAGGER=true`
- `NODE_ENV` diferente de `production`

URL:

- `http://localhost:3000/api/docs`
