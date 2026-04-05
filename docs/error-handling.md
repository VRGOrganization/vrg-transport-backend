# Tratamento de Erros

## Estrutura Padrão de Resposta de Erro

Todos os erros são formatados pelo `HttpExceptionFilter` global:

```json
{
  "statusCode": 401,
  "message": "Credenciais inválidas",
  "timestamp": "2024-03-15T14:32:11.452Z",
  "path": "/api/v1/auth/student/login"
}
```

| Campo | Tipo | Presença | Descrição |
|---|---|---|---|
| `statusCode` | `number` | Sempre | Código HTTP do erro |
| `message` | `string` | Sempre | Descrição do erro |
| `timestamp` | `string` | Sempre | ISO 8601 do momento do erro |
| `path` | `string` | Somente em `development` | Rota que gerou o erro |

> Em `NODE_ENV=production`, o campo `path` é omitido. Erros 5xx não expõem detalhes internos — apenas `"Internal server error"`.

---

## Códigos HTTP Utilizados

| Status | Quando ocorre |
|---|---|
| `200 OK` | Requisição bem-sucedida (GET, PATCH, DELETE com retorno, POST de logout) |
| `201 Created` | Recurso criado com sucesso (register, create employee, create license, create image) |
| `400 Bad Request` | Dados inválidos no body, parâmetro `:id` não é um ObjectId válido |
| `401 Unauthorized` | Token ausente, expirado ou inválido; credenciais incorretas; conta não verificada |
| `403 Forbidden` | Autenticado, mas sem permissão para o recurso (role insuficiente) |
| `404 Not Found` | Recurso não encontrado (estudante, funcionário, licença, imagem) |
| `409 Conflict` | Recurso já existe (e-mail duplicado, registrationId duplicado) |
| `422 Unprocessable Entity` | Estrutura de requisição válida, mas semanticamente inválida |
| `429 Too Many Requests` | Rate limit atingido para o endpoint |
| `500 Internal Server Error` | Erro inesperado no servidor |

---

## Exemplos de Resposta de Erro

### 400 — Parâmetro inválido

```bash
GET /api/v1/student/nao-e-um-objectid
```

```json
{
  "statusCode": 400,
  "message": "ID inválido: nao-e-um-objectid",
  "timestamp": "2024-03-15T14:30:00.000Z"
}
```

### 400 — Body inválido (ValidationPipe)

```bash
POST /api/v1/auth/student/register
Content-Type: application/json

{ "email": "nao-e-email", "password": "abc" }
```

```json
{
  "statusCode": 400,
  "message": ["E-mail inválido", "password must be longer than or equal to 8 characters"],
  "timestamp": "2024-03-15T14:30:00.000Z"
}
```

### 401 — Token ausente ou inválido

```bash
GET /api/v1/auth/me
# sem header Authorization
```

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "timestamp": "2024-03-15T14:30:00.000Z"
}
```

### 401 — Credenciais inválidas

```bash
POST /api/v1/auth/student/login
{ "email": "usuario@email.com", "password": "senhaerrada" }
```

```json
{
  "statusCode": 401,
  "message": "Credenciais inválidas",
  "timestamp": "2024-03-15T14:30:00.000Z"
}
```

> A mensagem é idêntica para e-mail não cadastrado e senha incorreta — proteção contra enumeração de usuários.

### 401 — Conta não verificada

```json
{
  "statusCode": 401,
  "message": "E-mail não verificado. Verifique sua caixa de entrada.",
  "timestamp": "2024-03-15T14:30:00.000Z"
}
```

### 401 — Código OTP inválido

```json
{
  "statusCode": 401,
  "message": "Código inválido ou expirado",
  "timestamp": "2024-03-15T14:30:00.000Z"
}
```

### 403 — Role insuficiente

```bash
GET /api/v1/employee
Authorization: Bearer <token de STUDENT>
```

```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "timestamp": "2024-03-15T14:30:00.000Z"
}
```

### 404 — Recurso não encontrado

```bash
GET /api/v1/student/64f3a000000000000000abcd
```

```json
{
  "statusCode": 404,
  "message": "Estudante não encontrado",
  "timestamp": "2024-03-15T14:30:00.000Z"
}
```

### 409 — Conflito (duplicata)

```bash
POST /api/v1/auth/student/register
{ "email": "ja.cadastrado@email.com", ... }
```

```json
{
  "statusCode": 409,
  "message": "E-mail já cadastrado",
  "timestamp": "2024-03-15T14:30:00.000Z"
}
```

### 429 — Rate limit atingido

```json
{
  "statusCode": 429,
  "message": "Too Many Requests",
  "timestamp": "2024-03-15T14:30:00.000Z"
}
```

---

## Comportamento em Produção vs Desenvolvimento

| Comportamento | Development | Production |
|---|---|---|
| Campo `path` na resposta | ✅ Incluído | ❌ Omitido |
| Stack trace no log | ✅ Incluído | ✅ Incluído (servidor), ❌ nunca no cliente |
| Detalhes de erro 5xx | Mensagem original | `"Internal server error"` |
| Swagger ativo | ✅ (se `ENABLE_SWAGGER=true`) | ❌ Sempre desativado |
