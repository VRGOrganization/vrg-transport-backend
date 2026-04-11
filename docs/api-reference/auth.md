# API Reference - Auth

Base: /api/v1/auth

Todos endpoints do controller de auth exigem x-service-secret.

## Headers

- x-service-secret: obrigatorio
- x-session-id: obrigatorio em rotas autenticadas

## POST /auth/student/register

Cria estudante pendente e envia OTP.

Rate limit: 20 req / 60s

Body:

{
  "name": "Maria Silva",
  "email": "maria@escola.edu.br",
  "password": "Senha123",
  "telephone": "21999998888",
  "cpf": "12345678909"
}

Respostas: 201, 400, 409, 429

## POST /auth/student/verify

Valida OTP e cria sessao.

Rate limit: 5 req / 60s

Body:

{
  "email": "maria@escola.edu.br",
  "code": "123456"
}

Respostas: 200, 400, 401, 429

## POST /auth/student/resend-code

Reenvia OTP com resposta generica anti-enumeracao.

Rate limit: 3 req / 60s

Body:

{
  "email": "maria@escola.edu.br"
}

Respostas: 200, 429

## POST /auth/student/login

Rate limit: 5 req / 60s

Body:

{
  "email": "maria@escola.edu.br",
  "password": "Senha123"
}

Respostas: 200, 401, 429

## POST /auth/employee/login

Rate limit: 5 req / 60s

Body:

{
  "registrationId": "EMP001",
  "password": "Senha123"
}

Respostas: 200, 401, 429

## POST /auth/admin/login

Rate limit: 3 req / 60s

Body:

{
  "username": "admin",
  "password": "Admin123"
}

Respostas: 200, 401, 429

## GET /auth/me

Retorna dados basicos da sessao:

{
  "userId": "...",
  "userType": "student"
}

Respostas: 200, 401

## POST /auth/logout

Logout idempotente.

- Publico do ponto de vista de sessao
- x-service-secret continua obrigatorio
- x-session-id opcional

Retorno:

{
  "ok": true
}

## GET /auth/admin/dashboard

Somente ADMIN.

Respostas: 200, 403
