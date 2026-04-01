# API Reference — Employees

Base: `/api/v1/employee`  
Todos os endpoints requerem autenticação JWT com role **ADMIN**.

---

## POST /employee

Cria um novo funcionário.

**Roles:** ADMIN

### Body

| Campo | Tipo | Obrigatório | Validações |
|---|---|---|---|
| `name` | `string` | Sim | Máx. 100 chars; espaços removidos nas bordas |
| `email` | `string` | Sim | E-mail válido; convertido para minúsculas |
| `registrationId` | `string` | Sim | Matrícula; espaços removidos nas bordas |
| `password` | `string` | Sim | 8–64 chars; deve conter maiúscula, minúscula e número |

### Respostas

| Status | Descrição |
|---|---|
| `201` | Funcionário criado |
| `400` | Dados inválidos |
| `401` | Token ausente ou inválido |
| `403` | Role não é ADMIN |
| `409` | E-mail ou matrícula já cadastrados |

### Exemplo

```bash
curl -X POST https://api.vrgtransport.com.br/api/v1/employee \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Ferreira",
    "email": "joao.ferreira@prefeitura.gov.br",
    "registrationId": "FUNC-0042",
    "password": "Senha@1234"
  }'
```

```json
{
  "_id": "64f3a1b2c3d4e5f6a7b8c9d1",
  "name": "João Ferreira",
  "email": "joao.ferreira@prefeitura.gov.br",
  "registrationId": "FUNC-0042",
  "active": true
}
```

---

## GET /employee

Lista todos os funcionários.

**Roles:** ADMIN

### Respostas

| Status | Descrição |
|---|---|
| `200` | Array de funcionários |
| `401` | Token ausente ou inválido |
| `403` | Role não é ADMIN |

### Exemplo

```bash
curl https://api.vrgtransport.com.br/api/v1/employee \
  -H "Authorization: Bearer eyJ..."
```

```json
[
  {
    "_id": "64f3a1b2c3d4e5f6a7b8c9d1",
    "name": "João Ferreira",
    "email": "joao.ferreira@prefeitura.gov.br",
    "registrationId": "FUNC-0042",
    "active": true
  }
]
```

---

## GET /employee/:id

Retorna um funcionário pelo ID.

**Roles:** ADMIN  
**Parâmetro:** `:id` — MongoDB ObjectId (validado por `MongoObjectIdPipe`)

### Respostas

| Status | Descrição |
|---|---|
| `200` | Dados do funcionário |
| `400` | ID inválido |
| `401` | Token ausente ou inválido |
| `403` | Role não é ADMIN |
| `404` | Funcionário não encontrado |

### Exemplo

```bash
curl https://api.vrgtransport.com.br/api/v1/employee/64f3a1b2c3d4e5f6a7b8c9d1 \
  -H "Authorization: Bearer eyJ..."
```

---

## PATCH /employee/:id

Atualiza os dados de um funcionário. Todos os campos são opcionais.

**Roles:** ADMIN  
**Parâmetro:** `:id` — MongoDB ObjectId

### Body

| Campo | Tipo | Obrigatório | Validações |
|---|---|---|---|
| `name` | `string` | Não | Máx. 100 chars |
| `email` | `string` | Não | E-mail válido |
| `registrationId` | `string` | Não | Matrícula |
| `password` | `string` | Não | 8–64 chars; maiúscula, minúscula e número |

### Respostas

| Status | Descrição |
|---|---|
| `200` | Funcionário atualizado |
| `400` | ID inválido ou dados inválidos |
| `401` | Token ausente ou inválido |
| `403` | Role não é ADMIN |
| `404` | Funcionário não encontrado |
| `409` | E-mail ou matrícula já usados por outro funcionário |

### Exemplo

```bash
curl -X PATCH https://api.vrgtransport.com.br/api/v1/employee/64f3a1b2c3d4e5f6a7b8c9d1 \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"name": "João Ferreira da Silva"}'
```

---

## DELETE /employee/:id

Desativa um funcionário (soft delete). O registro permanece no banco com `active: false`.

**Roles:** ADMIN  
**Parâmetro:** `:id` — MongoDB ObjectId

### Respostas

| Status | Descrição |
|---|---|
| `200` | Funcionário desativado |
| `400` | ID inválido |
| `401` | Token ausente ou inválido |
| `403` | Role não é ADMIN |
| `404` | Funcionário não encontrado |

### Exemplo

```bash
curl -X DELETE https://api.vrgtransport.com.br/api/v1/employee/64f3a1b2c3d4e5f6a7b8c9d1 \
  -H "Authorization: Bearer eyJ..."
```

```json
{
  "_id": "64f3a1b2c3d4e5f6a7b8c9d1",
  "name": "João Ferreira",
  "active": false
}
```

> O funcionário é **desativado**, não excluído permanentemente. Para reativar, use `PATCH /employee/:id` com `{ "active": true }` — a confirmar se o campo `active` é exposto no `UpdateEmployeeDto`.
