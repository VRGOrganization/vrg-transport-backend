# API Reference — Auth

Base: `/api/v1/auth`  
Todos os endpoints deste módulo são **públicos** (sem JWT), mas possuem rate limiting por IP.

---

## POST /auth/student/register

Registra um novo estudante. A conta fica com status `PENDING` até a verificação de e-mail.

**Rate limit:** 3 requisições / 60 segundos

### Body

| Campo | Tipo | Obrigatório | Validações |
|---|---|---|---|
| `name` | `string` | Sim | Máx. 100 chars; espaços removidos nas bordas |
| `email` | `string` | Sim | E-mail válido; convertido para minúsculas |
| `password` | `string` | Sim | 8–64 chars; deve conter maiúscula, minúscula e número |
| `telephone` | `string` | Sim | 10–13 dígitos; caracteres não-numéricos são removidos |

### Respostas

| Status | Descrição |
|---|---|
| `201` | Estudante criado; e-mail de verificação enviado |
| `400` | Dados inválidos |
| `409` | E-mail já cadastrado |
| `429` | Rate limit atingido |

### Exemplo

```bash
curl -X POST https://api.vrgtransport.com.br/api/v1/auth/student/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria Silva",
    "email": "maria@escola.edu.br",
    "password": "Senha@1234",
    "telephone": "11987654321"
  }'
```

```json
{
  "message": "Cadastro realizado. Verifique seu e-mail.",
  "isInstitutional": true
}
```

---

## POST /auth/student/verify

Verifica o e-mail do estudante com o código OTP enviado. Ativa a conta e retorna tokens JWT.

**Rate limit:** 5 requisições / 60 segundos

### Body

| Campo | Tipo | Obrigatório | Validações |
|---|---|---|---|
| `email` | `string` | Sim | E-mail válido; convertido para minúsculas |
| `code` | `string` | Sim | Exatamente 6 dígitos numéricos |

### Respostas

| Status | Descrição |
|---|---|
| `200` | E-mail verificado; retorna par de tokens |
| `400` | Dados inválidos |
| `401` | Código inválido, expirado ou conta bloqueada por tentativas |
| `429` | Rate limit atingido |

### Exemplo

```bash
curl -X POST https://api.vrgtransport.com.br/api/v1/auth/student/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "maria@escola.edu.br", "code": "483921"}'
```

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "64f3a1b2c3d4e5f6a7b8c9d0",
    "role": "student",
    "identifier": "maria@escola.edu.br"
  }
}
```

---

## POST /auth/student/resend-code

Reenvia o código OTP. Cooldown de 60 segundos entre reenvios.

**Rate limit:** 3 requisições / 60 segundos

### Body

| Campo | Tipo | Obrigatório | Validações |
|---|---|---|---|
| `email` | `string` | Sim | E-mail válido; convertido para minúsculas |

### Respostas

| Status | Descrição |
|---|---|
| `200` | Novo código enviado |
| `400` | Dados inválidos |
| `401` | Cooldown ainda ativo ou conta não encontrada |
| `429` | Rate limit atingido |

### Exemplo

```bash
curl -X POST https://api.vrgtransport.com.br/api/v1/auth/student/resend-code \
  -H "Content-Type: application/json" \
  -d '{"email": "maria@escola.edu.br"}'
```

```json
{ "message": "Código reenviado. Verifique seu e-mail." }
```

---

## POST /auth/student/login

Autentica um estudante (requer conta com status `ACTIVE`).

**Rate limit:** 5 requisições / 60 segundos

### Body

| Campo | Tipo | Obrigatório | Validações |
|---|---|---|---|
| `email` | `string` | Sim | E-mail válido; convertido para minúsculas |
| `password` | `string` | Sim | Mín. 6 chars |

### Respostas

| Status | Descrição |
|---|---|
| `200` | Login bem-sucedido; retorna par de tokens |
| `400` | Dados inválidos |
| `401` | Credenciais inválidas ou conta não verificada |
| `429` | Rate limit atingido |

### Exemplo

```bash
curl -X POST https://api.vrgtransport.com.br/api/v1/auth/student/login \
  -H "Content-Type: application/json" \
  -d '{"email": "maria@escola.edu.br", "password": "Senha@1234"}'
```

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "64f3a1b2c3d4e5f6a7b8c9d0",
    "role": "student",
    "identifier": "maria@escola.edu.br"
  }
}
```

---

## POST /auth/employee/login

Autentica um funcionário com matrícula e senha.

**Rate limit:** 5 requisições / 60 segundos

### Body

| Campo | Tipo | Obrigatório | Validações |
|---|---|---|---|
| `registrationId` | `string` | Sim | Espaços removidos nas bordas |
| `password` | `string` | Sim | Mín. 6 chars |

### Respostas

| Status | Descrição |
|---|---|
| `200` | Login bem-sucedido; retorna par de tokens |
| `400` | Dados inválidos |
| `401` | Credenciais inválidas |
| `429` | Rate limit atingido |

### Exemplo

```bash
curl -X POST https://api.vrgtransport.com.br/api/v1/auth/employee/login \
  -H "Content-Type: application/json" \
  -d '{"registrationId": "FUNC-0042", "password": "Senha@1234"}'
```

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": {
    "id": "64f3a1b2c3d4e5f6a7b8c9d1",
    "role": "employee",
    "identifier": "FUNC-0042"
  }
}
```

---

## POST /auth/admin/login

Autentica um administrador com username e senha.

**Rate limit:** 3 requisições / 60 segundos

### Body

| Campo | Tipo | Obrigatório | Validações |
|---|---|---|---|
| `username` | `string` | Sim | Convertido para minúsculas e espaços removidos |
| `password` | `string` | Sim | Mín. 6 chars |

### Respostas

| Status | Descrição |
|---|---|
| `200` | Login bem-sucedido; retorna par de tokens |
| `400` | Dados inválidos |
| `401` | Credenciais inválidas |
| `429` | Rate limit atingido |

### Exemplo

```bash
curl -X POST https://api.vrgtransport.com.br/api/v1/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin@1234"}'
```

---

## POST /auth/refresh

Obtém um novo par de tokens usando o refresh token. O token anterior é invalidado.

**Rate limit:** 10 requisições / 60 segundos

### Body

| Campo | Tipo | Obrigatório | Validações |
|---|---|---|---|
| `refresh_token` | `string` | Sim | JWT válido |

### Respostas

| Status | Descrição |
|---|---|
| `200` | Novo par de tokens emitido |
| `400` | Dados inválidos |
| `401` | Token inválido, expirado ou reutilizado |
| `429` | Rate limit atingido |

### Exemplo

```bash
curl -X POST https://api.vrgtransport.com.br/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "eyJ..."}'
```

---

## GET /auth/me

Retorna o perfil do usuário autenticado.

**Autenticação:** Bearer token obrigatório  
**Roles:** STUDENT, EMPLOYEE, ADMIN

### Respostas

| Status | Descrição |
|---|---|
| `200` | Perfil do usuário |
| `401` | Token ausente ou inválido |

### Exemplo

```bash
curl https://api.vrgtransport.com.br/api/v1/auth/me \
  -H "Authorization: Bearer eyJ..."
```

```json
{
  "id": "64f3a1b2c3d4e5f6a7b8c9d0",
  "role": "student",
  "identifier": "maria@escola.edu.br"
}
```

---

## POST /auth/logout

Revoga o refresh token da sessão atual.

**Autenticação:** Bearer token obrigatório  
**Roles:** STUDENT, EMPLOYEE, ADMIN

### Respostas

| Status | Descrição |
|---|---|
| `200` | Logout realizado; refresh token invalidado |
| `401` | Token ausente ou inválido |

### Exemplo

```bash
curl -X POST https://api.vrgtransport.com.br/api/v1/auth/logout \
  -H "Authorization: Bearer eyJ..."
```

```json
{ "message": "Logout realizado com sucesso" }
```

---

## GET /auth/admin/dashboard

Retorna dados do dashboard administrativo.

**Autenticação:** Bearer token obrigatório  
**Roles:** ADMIN apenas

### Respostas

| Status | Descrição |
|---|---|
| `200` | Dados do dashboard |
| `401` | Token ausente ou inválido |
| `403` | Role insuficiente |

### Exemplo

```bash
curl https://api.vrgtransport.com.br/api/v1/auth/admin/dashboard \
  -H "Authorization: Bearer eyJ..."
```

> O formato exato da resposta do dashboard está a confirmar na implementação.
