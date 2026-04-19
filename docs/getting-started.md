# Começando

## Requisitos

- Node.js 22+
- npm 10+
- MongoDB 7+
- Docker opcional

## Instalação

```bash
npm install
```

## Variáveis de ambiente

### Obrigatórias

| Variável | Uso |
|---|---|
| `SERVICE_SECRET` | segredo compartilhado entre BFF e backend |
| `SESSION_TTL_STUDENT_DAYS` ou `SESSION_TTL_DAYS` | TTL de sessão do estudante |
| `SESSION_TTL_STAFF_DAYS` ou `SESSION_TTL_DAYS` | TTL de sessão de staff |
| `ALLOWED_ORIGINS` | origens permitidas |
| `MONGODB_URI` | banco principal |
| `MONGODB_URI_IMAGE` | banco de imagens |
| `OTP_PEPPER` | proteção do OTP |
| `CPF_HMAC_SECRET` | hash do CPF |
| `LICENSE_API_URL` | serviço externo de emissão |
| `LICENSE_API_KEY` | chave do serviço externo |
| `QR_CODE_BASE_URL` | base pública do QR de verificação |
| `BREVO_API_KEY` | envio de e-mails |
| `MAIL_FROM_ADDRESS` | remetente |

### Opcionais relevantes

| Variável | Padrão | Uso |
|---|---|---|
| `PORT` | `3000` | porta HTTP |
| `NODE_ENV` | `development` | ambiente |
| `MAIL_FROM_NAME` | `VRG Transport` | nome do remetente |
| `LICENSE_API_TIMEOUT_MS` | `5000` | timeout do emissor externo |
| `ENABLE_SWAGGER` | `false` | habilita Swagger |
| `TRUST_PROXY_HOPS` | `1` | hops de proxy |

## Execução

```bash
npm run start:dev
npm run build
npm run start:prod
```

## Testes

```bash
npm test
npm run test:e2e
```

## Seed de admin

```bash
npm run seed:admin
```

## Swagger

Quando habilitado:

- `http://localhost:3000/api/docs`
