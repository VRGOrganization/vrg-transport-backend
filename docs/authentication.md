# Autenticação

## Modelo atual

A API usa sessão server-side. O BFF normalmente grava o `sessionId` em cookie próprio depois de receber a resposta do backend.

Headers principais:

- `x-service-secret`: obrigatório nas rotas do controller de auth
- `x-session-id`: usado para identificar a sessão em rotas autenticadas

## Fluxos

### Estudante com OTP

1. `POST /api/v1/auth/student/register`
2. `POST /api/v1/auth/student/verify`
3. `POST /api/v1/auth/student/resend-code`

### Login por papel

- `POST /api/v1/auth/student/login`
- `POST /api/v1/auth/employee/login`
- `POST /api/v1/auth/admin/login`

### Senha do estudante

- `POST /api/v1/auth/student/forgot-password`
- `POST /api/v1/auth/student/reset-password`

## Resposta de sessão

Rotas de login/verify retornam algo no formato:

```json
{
  "sessionId": "...",
  "user": {
    "id": "...",
    "role": "student",
    "name": "..."
  }
}
```

## Logout

- `POST /api/v1/auth/logout`
- idempotente
- continua exigindo `x-service-secret`
- `x-session-id` é opcional

## Rate limit

| Endpoint | Limite |
|---|---|
| `POST /auth/student/register` | 20 req / 60s |
| `POST /auth/student/verify` | 5 req / 60s |
| `POST /auth/student/resend-code` | 3 req / 60s |
| `POST /auth/student/login` | 5 req / 60s |
| `POST /auth/employee/login` | 5 req / 60s |
| `POST /auth/admin/login` | 3 req / 60s |
| `POST /auth/student/forgot-password` | 5 req / 60s |
| `POST /auth/student/reset-password` | 10 req / 60s |

## Regras de integração

- `x-service-secret` não deve sair do servidor/BFF
- OTP não deve aparecer em log de produção
- a política de senha é a mesma para cadastro e reset
