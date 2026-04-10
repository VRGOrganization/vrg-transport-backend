# Autenticação

## Modelo atual

A API usa sessão server-side e dois cabeçalhos principais:

- `x-session-id`: identifica sessão ativa
- `x-service-secret`: segredo compartilhado entre BFF e backend

No módulo `Auth`, `x-service-secret` é obrigatório em todos os endpoints.

## Fluxo de registro de estudante (OTP)

1. `POST /api/v1/auth/student/register`
   - body: `name`, `email`, `password`, `telephone`, `cpf`
   - valida CPF, email único e CPF único (hash HMAC)
   - cria estudante com status `PENDING`
   - gera OTP com expiração de 15 minutos
   - envia e-mail via Brevo

2. `POST /api/v1/auth/student/verify`
   - body: `email`, `code`
   - valida código
   - bloqueia após tentativas inválidas repetidas
   - ativa conta e cria sessão

3. `POST /api/v1/auth/student/resend-code`
   - body: `email`
   - retorna mensagem genérica para evitar enumeração de usuário
   - respeita cooldown

## Logins por perfil

| Endpoint | Credenciais |
|---|---|
| `POST /auth/student/login` | `email`, `password` |
| `POST /auth/employee/login` | `registrationId`, `password` |
| `POST /auth/admin/login` | `username`, `password` |

Todos retornam:

```json
{
  "ok": true,
  "sessionId": "...",
  "user": {
    "id": "...",
    "role": "student|employee|admin",
    "identifier": "...",
    "name": "..."
  }
}
```

## Sessão e TTL por perfil

A duração da sessão é configurada por variável de ambiente:

- `SESSION_TTL_STUDENT_DAYS` para estudante
- `SESSION_TTL_STAFF_DAYS` para funcionário/admin
- fallback legado: `SESSION_TTL_DAYS`

## Logout

`POST /auth/logout`:

- é público do ponto de vista de sessão (`@Public`)
- continua exigindo `x-service-secret`
- `x-session-id` é opcional
- resposta idempotente: `{ "ok": true }`

## Rate limit aplicado em Auth

| Endpoint | Limite |
|---|---|
| `POST /auth/student/register` | 20 req / 60s |
| `POST /auth/student/verify` | 5 req / 60s |
| `POST /auth/student/resend-code` | 3 req / 60s |
| `POST /auth/student/login` | 5 req / 60s |
| `POST /auth/employee/login` | 5 req / 60s |
| `POST /auth/admin/login` | 3 req / 60s |

## Observação sobre uso no frontend

`x-service-secret` nunca deve ser exposto no browser. O consumo correto é via BFF/server-side.
