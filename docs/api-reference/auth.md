# API Reference - Auth

Base: `/api/v1/auth`

Todos os endpoints do controller exigem `x-service-secret`.

## Headers

- `x-service-secret`: obrigatório
- `x-session-id`: usado pelo backend para identificar a sessão

## `POST /auth/student/register`

Cria estudante pendente e envia OTP.

## `POST /auth/student/verify`

Valida OTP e cria sessão.

## `POST /auth/student/resend-code`

Reenvia o código de verificação.

## `POST /auth/student/login`

Login do estudante por e-mail e senha.

## `POST /auth/employee/login`

Login do funcionário por matrícula e senha.

## `POST /auth/admin/login`

Login do admin por username e senha.

## `GET /auth/me`

Retorna a sessão autenticada.

## `POST /auth/logout`

Logout idempotente.

## `POST /auth/student/forgot-password`

Solicita redefinição de senha.

## `POST /auth/student/reset-password`

Redefine a senha com token.

## `GET /auth/admin/dashboard`

Dashboard restrito a `ADMIN`.
