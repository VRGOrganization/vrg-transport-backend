# Getting Started

## Pre-requisitos

- Node.js 22+
- npm 10+
- MongoDB 7+
- Docker (opcional)

## Instalacao

1. Instale dependencias:

	npm install

2. Configure env local:

	copie .env.example para .env e ajuste os valores.

## Variaveis obrigatorias

| Variavel | Descricao |
|---|---|
| SERVICE_SECRET | Segredo compartilhado entre BFF e backend (min 32) |
| SESSION_TTL_STUDENT_DAYS ou SESSION_TTL_DAYS | TTL de sessao para estudante |
| SESSION_TTL_STAFF_DAYS ou SESSION_TTL_DAYS | TTL de sessao para staff |
| ALLOWED_ORIGINS | Lista CSV de origens permitidas |
| MONGODB_URI | Mongo principal |
| MONGODB_URI_IMAGE | Mongo de imagens |
| OTP_PEPPER | Segredo OTP (min 16) |
| CPF_HMAC_SECRET | Segredo hash de CPF (min 16) |
| LICENSE_API_URL | URL do emissor externo |
| LICENSE_API_KEY | Chave do emissor externo |
| QR_CODE_BASE_URL | URL base de verificacao publica |
| BREVO_API_KEY | Chave Brevo |
| MAIL_FROM_ADDRESS | Email remetente |

## Variaveis opcionais relevantes

| Variavel | Padrao | Descricao |
|---|---|---|
| PORT | 3000 | Porta HTTP |
| NODE_ENV | development | Ambiente |
| MAIL_FROM_NAME | VRG Transport | Nome remetente |
| LICENSE_API_TIMEOUT_MS | 5000 | Timeout emissor externo |
| ENABLE_SWAGGER | false | Swagger em dev/homolog |
| TRUST_PROXY_HOPS | 1 | Hops de proxy |

## Execucao

Desenvolvimento:

npm run start:dev

Build + producao:

npm run build
npm run start:prod

Docker:

npm run docker:up
npm run docker:logs
npm run docker:down

## Seed de admin

npm run seed:admin

## Testes

npm test
npm run test:e2e

## Swagger

Disponivel quando:

- ENABLE_SWAGGER=true
- NODE_ENV diferente de production

URL padrao:

http://localhost:3000/api/docs
