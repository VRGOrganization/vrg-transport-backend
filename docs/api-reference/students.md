# API Reference — Students

Base: `/api/v1/student`  
Todos os endpoints requerem autenticação por sessão (x-session-id).

---

## Enums

### Shift (Turno)

| Valor | Descrição |
|---|---|
| `Matutino` | Manhã |
| `Vespertino` | Tarde |
| `Noturno` | Noite |
| `Integral` | Período integral |

### BloodType (Tipo Sanguíneo)

| Valor |
|---|
| `A+` |
| `A-` |
| `B+` |
| `B-` |
| `AB+` |
| `AB-` |
| `O+` |
| `O-` |

---

## GET /student

Lista todos os estudantes.

**Roles:** EMPLOYEE, ADMIN

### Respostas

| Status | Descrição |
|---|---|
| `200` | Array de estudantes |
| `401` | Sessão ausente ou inválida |
| `403` | Role insuficiente (STUDENT não tem acesso) |

### Exemplo

```bash
curl https://api.vrgtransport.com.br/api/v1/student \
  -H "x-session-id: <session-id>"
```

```json
[
  {
    "_id": "64f3a1b2c3d4e5f6a7b8c9d0",
    "name": "Maria Silva",
    "email": "maria@escola.edu.br",
    "degree": "Ensino Médio",
    "shift": "Matutino",
    "telephone": "11987654321",
    "bloodType": "O+",
    "bus": "Linha 42",
    "status": "ACTIVE",
    "isInstitutionalEmail": true,
    "active": true
  }
]
```

---

## GET /student/me

Retorna o perfil do estudante autenticado.

**Roles:** STUDENT (somente o próprio perfil)

### Respostas

| Status | Descrição |
|---|---|
| `200` | Perfil do estudante |
| `401` | Sessão ausente ou inválida |
| `403` | Role não é STUDENT |
| `404` | Estudante não encontrado |

### Exemplo

```bash
curl https://api.vrgtransport.com.br/api/v1/student/me \
  -H "x-session-id: <session-id>"
```

```json
{
  "_id": "64f3a1b2c3d4e5f6a7b8c9d0",
  "name": "Maria Silva",
  "email": "maria@escola.edu.br",
  "degree": "Ensino Médio",
  "shift": "Matutino",
  "telephone": "11987654321",
  "bloodType": "O+",
  "bus": "Linha 42",
  "status": "ACTIVE",
  "isInstitutionalEmail": true,
  "active": true
}
```

---

## GET /student/:id

Retorna um estudante pelo ID.

**Roles:** EMPLOYEE, ADMIN  
**Parâmetro:** `:id` — MongoDB ObjectId (validado por `MongoObjectIdPipe`)

### Respostas

| Status | Descrição |
|---|---|
| `200` | Dados do estudante |
| `400` | ID inválido (não é ObjectId) |
| `401` | Sessão ausente ou inválida |
| `403` | Role insuficiente |
| `404` | Estudante não encontrado |

### Exemplo

```bash
curl https://api.vrgtransport.com.br/api/v1/student/64f3a1b2c3d4e5f6a7b8c9d0 \
  -H "x-session-id: <session-id>"
```

---

## PATCH /student/me

Atualiza o perfil do estudante autenticado. Todos os campos são opcionais.

**Roles:** STUDENT (somente o próprio perfil)

### Body

| Campo | Tipo | Obrigatório | Validações |
|---|---|---|---|
| `name` | `string` | Não | Máx. 100 chars; espaços removidos nas bordas |
| `degree` | `string` | Não | Máx. 100 chars |
| `shift` | `Shift` | Não | Um dos valores do enum Shift |
| `telephone` | `string` | Não | 10–15 chars (aceita `+`, espaços, hífens, parênteses) |
| `bloodType` | `BloodType` | Não | Um dos valores do enum BloodType |
| `bus` | `string` | Não | Máx. 100 chars |

> `email` e `password` não podem ser alterados por este endpoint.

### Respostas

| Status | Descrição |
|---|---|
| `200` | Perfil atualizado |
| `400` | Dados inválidos |
| `401` | Sessão ausente ou inválida |
| `403` | Role não é STUDENT |
| `404` | Estudante não encontrado |

### Exemplo

```bash
curl -X PATCH https://api.vrgtransport.com.br/api/v1/student/me \
  -H "x-session-id: <session-id>" \
  -H "Content-Type: application/json" \
  -d '{"bus": "Linha 15", "telephone": "11999990000"}'
```

---

## PATCH /student/:id

Atualiza os dados de um estudante pelo ID. Todos os campos são opcionais.

**Roles:** ADMIN  
**Parâmetro:** `:id` — MongoDB ObjectId

### Body

Mesmos campos de `PATCH /student/me`.

### Respostas

| Status | Descrição |
|---|---|
| `200` | Estudante atualizado |
| `400` | ID inválido ou dados inválidos |
| `401` | Sessão ausente ou inválida |
| `403` | Role não é ADMIN |
| `404` | Estudante não encontrado |

### Exemplo

```bash
curl -X PATCH https://api.vrgtransport.com.br/api/v1/student/64f3a1b2c3d4e5f6a7b8c9d0 \
  -H "x-session-id: <session-id>" \
  -H "Content-Type: application/json" \
  -d '{"degree": "Ensino Superior", "shift": "Noturno"}'
```

---

## DELETE /student/:id

Remove um estudante pelo ID.

**Roles:** ADMIN  
**Parâmetro:** `:id` — MongoDB ObjectId

### Respostas

| Status | Descrição |
|---|---|
| `200` | Estudante removido |
| `400` | ID inválido |
| `401` | Sessão ausente ou inválida |
| `403` | Role não é ADMIN |
| `404` | Estudante não encontrado |

### Exemplo

```bash
curl -X DELETE https://api.vrgtransport.com.br/api/v1/student/64f3a1b2c3d4e5f6a7b8c9d0 \
  -H "x-session-id: <session-id>"
```

