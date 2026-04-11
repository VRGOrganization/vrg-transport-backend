# Autenticacao

## Modelo atual

A API usa sessao server-side e dois headers principais:

- x-session-id: identifica sessao ativa
- x-service-secret: segredo compartilhado para rotas de auth

No AuthController, todos endpoints exigem x-service-secret.

## Fluxo de estudante com OTP

1. POST /api/v1/auth/student/register
   - body: name, email, password, telephone, cpf
   - cria conta pendente e envia OTP

2. POST /api/v1/auth/student/verify
   - body: email, code
   - ativa conta e cria sessao

3. POST /api/v1/auth/student/resend-code
   - body: email
   - resposta generica anti-enumeracao

## Logins por perfil

| Endpoint | Credencial |
|---|---|
| POST /auth/student/login | email + password |
| POST /auth/employee/login | registrationId + password |
| POST /auth/admin/login | username + password |

Resposta de login/verify:

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

## Sessao e expiracao

TTL por env:

- SESSION_TTL_STUDENT_DAYS para estudante
- SESSION_TTL_STAFF_DAYS para employee/admin
- fallback legado: SESSION_TTL_DAYS

## Logout

POST /auth/logout:

- publico em relacao a sessao
- continua exigindo x-service-secret
- x-session-id opcional
- resposta idempotente: { "ok": true }

## Rate limit no modulo Auth

| Endpoint | Limite |
|---|---|
| POST /auth/student/register | 20 req / 60s |
| POST /auth/student/verify | 5 req / 60s |
| POST /auth/student/resend-code | 3 req / 60s |
| POST /auth/student/login | 5 req / 60s |
| POST /auth/employee/login | 5 req / 60s |
| POST /auth/admin/login | 3 req / 60s |

## Recomendacao de consumo

Nao exponha x-service-secret no browser.
Use BFF/server-side para intermediar chamadas de auth.
