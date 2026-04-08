# API Reference — Auth

Base: `/api/v1/auth`

Todos os endpoints deste modulo exigem o header `x-service-secret`. Eles sao destinados ao BFF (server-side) e nao devem ser chamados diretamente pelo browser.

---

## Headers obrigatorios

- `x-service-secret`: segredo compartilhado entre BFF e backend.
- `x-session-id`: exigido somente em endpoints autenticados (ex.: `GET /auth/me`).

---

## POST /auth/student/register

Registra um novo estudante. A conta fica com status `PENDING` ate a verificacao de e-mail.

**Rate limit:** 3 requisicoes / 60 segundos

### Body

| Campo | Tipo | Obrigatorio | Validacoes |
|---|---|---|---|
| `name` | `string` | Sim | Max. 100 chars; espacos removidos nas bordas |
| `email` | `string` | Sim | E-mail valido; convertido para minusculas |
| `password` | `string` | Sim | 8–64 chars; deve conter maiuscula, minuscula e numero |
| `telephone` | `string` | Sim | 10–13 digitos; caracteres nao-numericos sao removidos |

### Respostas

| Status | Descricao |
|---|---|
| `201` | Estudante criado; e-mail de verificacao enviado |
| `400` | Dados invalidos |
| `409` | E-mail ja cadastrado |
| `429` | Rate limit atingido |

### Exemplo

```bash
curl -X POST https://api.vrgtransport.com.br/api/v1/auth/student/register \
  -H "Content-Type: application/json" \
  -H "x-service-secret: <segredo>" \
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

Verifica o e-mail do estudante com o codigo OTP enviado. Ativa a conta e cria sessao.

**Rate limit:** 5 requisicoes / 60 segundos

### Body

| Campo | Tipo | Obrigatorio | Validacoes |
|---|---|---|---|
| `email` | `string` | Sim | E-mail valido; convertido para minusculas |
| `code` | `string` | Sim | Exatamente 6 digitos numericos |

### Respostas

| Status | Descricao |
|---|---|
| `200` | E-mail verificado; sessao criada |
| `400` | Dados invalidos |
| `401` | Codigo invalido, expirado ou conta bloqueada por tentativas |
| `429` | Rate limit atingido |

### Exemplo

```bash
curl -X POST https://api.vrgtransport.com.br/api/v1/auth/student/verify \
  -H "Content-Type: application/json" \
  -H "x-service-secret: <segredo>" \
  -d '{"email": "maria@escola.edu.br", "code": "483921"}'
```

```json
{
  "ok": true,
  "sessionId": "507f1f77bcf86cd799439011",
  "user": {
    "id": "64f3a1b2c3d4e5f6a7b8c9d0",
    "role": "student",
    "identifier": "maria@escola.edu.br",
    "name": "Maria Silva"
  }
}
```

---

## POST /auth/student/resend-code

Reenvia o codigo OTP. Cooldown de 60 segundos entre reenvios.

**Rate limit:** 3 requisicoes / 60 segundos

### Body

| Campo | Tipo | Obrigatorio | Validacoes |
|---|---|---|---|
| `email` | `string` | Sim | E-mail valido; convertido para minusculas |

### Respostas

| Status | Descricao |
|---|---|
| `200` | Novo codigo enviado |
| `400` | Dados invalidos |
| `401` | Cooldown ainda ativo ou conta nao encontrada |
| `429` | Rate limit atingido |

### Exemplo

```bash
curl -X POST https://api.vrgtransport.com.br/api/v1/auth/student/resend-code \
  -H "Content-Type: application/json" \
  -H "x-service-secret: <segredo>" \
  -d '{"email": "maria@escola.edu.br"}'
```

```json
{ "message": "Codigo reenviado. Verifique seu e-mail." }
```

---

## POST /auth/student/login

Autentica um estudante (requer conta com status `ACTIVE`).

**Rate limit:** 5 requisicoes / 60 segundos

### Body

| Campo | Tipo | Obrigatorio | Validacoes |
|---|---|---|---|
| `email` | `string` | Sim | E-mail valido; convertido para minusculas |
| `password` | `string` | Sim | Min. 6 chars |

### Respostas

| Status | Descricao |
|---|---|
| `200` | Login bem-sucedido; sessao criada |
| `400` | Dados invalidos |
| `401` | Credenciais invalidas ou conta nao verificada |
| `429` | Rate limit atingido |

### Exemplo

```bash
curl -X POST https://api.vrgtransport.com.br/api/v1/auth/student/login \
  -H "Content-Type: application/json" \
  -H "x-service-secret: <segredo>" \
  -d '{"email": "maria@escola.edu.br", "password": "Senha@1234"}'
```

```json
{
  "ok": true,
  "sessionId": "507f1f77bcf86cd799439011",
  "user": {
    "id": "64f3a1b2c3d4e5f6a7b8c9d0",
    "role": "student",
    "identifier": "maria@escola.edu.br",
    "name": "Maria Silva"
  }
}
```

---

## POST /auth/employee/login

Autentica um funcionario com matricula e senha.

**Rate limit:** 5 requisicoes / 60 segundos

### Body

| Campo | Tipo | Obrigatorio | Validacoes |
|---|---|---|---|
| `registrationId` | `string` | Sim | Espacos removidos nas bordas |
| `password` | `string` | Sim | Min. 6 chars |

### Respostas

| Status | Descricao |
|---|---|
| `200` | Login bem-sucedido; sessao criada |
| `400` | Dados invalidos |
| `401` | Credenciais invalidas |
| `429` | Rate limit atingido |

### Exemplo

```bash
curl -X POST https://api.vrgtransport.com.br/api/v1/auth/employee/login \
  -H "Content-Type: application/json" \
  -H "x-service-secret: <segredo>" \
  -d '{"registrationId": "FUNC-0042", "password": "Senha@1234"}'
```

---

## POST /auth/admin/login

Autentica um administrador com username e senha.

**Rate limit:** 3 requisicoes / 60 segundos

### Body

| Campo | Tipo | Obrigatorio | Validacoes |
|---|---|---|---|
| `username` | `string` | Sim | Convertido para minusculas e espacos removidos |
| `password` | `string` | Sim | Min. 6 chars |

### Respostas

| Status | Descricao |
|---|---|
| `200` | Login bem-sucedido; sessao criada |
| `400` | Dados invalidos |
| `401` | Credenciais invalidas |
| `429` | Rate limit atingido |

### Exemplo

```bash
curl -X POST https://api.vrgtransport.com.br/api/v1/auth/admin/login \
  -H "Content-Type: application/json" \
  -H "x-service-secret: <segredo>" \
  -d '{"username": "admin", "password": "Admin@1234"}'
```

---

## GET /auth/me

Retorna o perfil do usuario autenticado via sessao.

**Autenticacao:** `x-session-id` + `x-service-secret`  
**Roles:** STUDENT, EMPLOYEE, ADMIN

### Respostas

| Status | Descricao |
|---|---|
| `200` | Perfil do usuario |
| `401` | Sessao ausente ou invalida |

### Exemplo

```bash
curl https://api.vrgtransport.com.br/api/v1/auth/me \
  -H "x-session-id: <session-id>" \
  -H "x-service-secret: <segredo>"
```

```json
{
  "userId": "64f3a1b2c3d4e5f6a7b8c9d0",
  "userType": "student"
}
```

---

## POST /auth/logout

Logout idempotente. Sempre retorna sucesso, com ou sem sessao valida.

**Autenticacao:** `x-service-secret` (o `x-session-id` e opcional)

### Respostas

| Status | Descricao |
|---|---|
| `200` | Logout realizado |

### Exemplo

```bash
curl -X POST https://api.vrgtransport.com.br/api/v1/auth/logout \
  -H "x-service-secret: <segredo>" \
  -H "x-session-id: <session-id>"
```

```json
{ "ok": true }
```

---

## GET /auth/admin/dashboard

Retorna dados do dashboard administrativo.

**Autenticacao:** `x-session-id` + `x-service-secret`  
**Roles:** ADMIN apenas

### Respostas

| Status | Descricao |
|---|---|
| `200` | Dados do dashboard |
| `401` | Sessao ausente ou invalida |
| `403` | Role insuficiente |

### Exemplo

```bash
curl https://api.vrgtransport.com.br/api/v1/auth/admin/dashboard \
  -H "x-session-id: <session-id>" \
  -H "x-service-secret: <segredo>"
```

> O formato exato da resposta do dashboard esta a confirmar na implementacao.
