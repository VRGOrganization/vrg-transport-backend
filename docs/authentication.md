# Autenticação

## Modelo atual

A API usa sessão server-side. Em fluxos normais o backend retorna informações de sessão que devem ser armazenadas pelo BFF/cliente em um cookie seguro (`HttpOnly`, `Secure`, `SameSite`). Em integrações servidor-a-servidor controladas o `x-session-id` pode ser usado para propagar a sessão, mas isso não substitui o cookie em cenários browser/BFF.

Headers principais / guardas:

- `x-service-secret`: usado por endpoints sensíveis e pelo controller de auth (protegido por `ServiceSecretGuard`).
- Sessões autenticadas usam cookie de sessão; o backend também aceita o identificador de sessão via header em integrações controladas.

## Fluxos

### Estudante com OTP

1. `POST /api/v1/auth/student/register` — cria registro e envia OTP por SMS/email (conforme configuração).
2. `POST /api/v1/auth/student/verify` — valida OTP e inicia sessão server-side.
3. `POST /api/v1/auth/student/resend-code` — reenvia OTP (rate-limited).

### Login por papel

- `POST /api/v1/auth/student/login`
- `POST /api/v1/auth/employee/login`
- `POST /api/v1/auth/admin/login`

### Senha do estudante

- `POST /api/v1/auth/student/forgot-password`
- `POST /api/v1/auth/student/reset-password`

## Resposta de sessão

Rotas de login/verify retornam um payload com informações mínimas da sessão; o backend normalmente seta o cookie de sessão na resposta. Exemplo:

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

## Cookies e segurança de sessão

- O cookie de sessão deve ser `HttpOnly`, `Secure` em produção e usar `SameSite` apropriado para o fluxo de BFF (recomendado: `strict` ou `lax`).
- Tokens/OTPs não devem ser logados em produção.
- Sessões podem ser invalidadas via `POST /api/v1/auth/logout`.

## Rate limit (atual / recomendado)

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

## Integração e recomendações

- `x-service-secret` deve permanecer apenas em servidores confiáveis (BFF/backend). Nunca enviar esse header a clientes públicos.
- Use cookies seguros e `HttpOnly` para evitar exposição de sessão a scripts.
- A autenticação server-side facilita a aplicação de `RolesGuard` e a auditoria centralizada.
