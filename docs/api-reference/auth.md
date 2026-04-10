# API Reference — Auth

Base: `/api/v1/auth`

Todos os endpoints deste módulo exigem `x-service-secret`.

## Headers

- `x-service-secret`: obrigatório
- `x-session-id`: obrigatório apenas em rotas autenticadas

## POST /auth/student/register

Cria estudante pendente e envia OTP por e-mail.

Rate limit: 20 req / 60s

Body:

```json
{
  "name": "Maria Silva",
  "email": "maria@escola.edu.br",
  "password": "Senha123",
  "telephone": "21999998888",
  "cpf": "12345678909"
}
```

Respostas: `201`, `400`, `409`, `429`

## POST /auth/student/verify

Valida OTP e cria sessão.

Rate limit: 5 req / 60s

Body:

```json
{
  "email": "maria@escola.edu.br",
  "code": "123456"
}
```

Respostas: `200`, `400`, `401`, `429`

## POST /auth/student/resend-code

Reenvia OTP com cooldown e resposta genérica anti-enumeração.

Rate limit: 3 req / 60s

Body:

```json
{
  "email": "maria@escola.edu.br"
}
```

Respostas: `200`, `429`

## POST /auth/student/login

Rate limit: 5 req / 60s

Body:

```json
{
  "email": "maria@escola.edu.br",
  "password": "Senha123"
}
```

Respostas: `200`, `401`, `429`

## POST /auth/employee/login

Rate limit: 5 req / 60s

Body:

```json
{
  "registrationId": "EMP001",
  "password": "Senha123"
}
```

Respostas: `200`, `401`, `429`

## POST /auth/admin/login

Rate limit: 3 req / 60s

Body:

```json
{
  "username": "admin",
  "password": "Admin123"
}
```

Respostas: `200`, `401`, `429`

## GET /auth/me

Retorna sessão atual.

Respostas: `200`, `401`

Exemplo de retorno:

```json
{
  "userId": "...",
  "userType": "student"
}
```

## POST /auth/logout

Logout idempotente.

- público em relação à sessão
- ainda exige `x-service-secret`
- `x-session-id` opcional

Retorno:

```json
{
  "ok": true
}
```

## GET /auth/admin/dashboard

Acesso restrito a admin.

Respostas: `200`, `403`
