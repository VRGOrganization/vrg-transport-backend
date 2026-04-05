# API Reference — Licenses

Base: `/api/v1/license`  
Todos os endpoints requerem autenticação JWT.

As licenças são carteirinhas digitais de estudante geradas por um **serviço externo** via `LICENSE_API_URL`. A API VRG Transport orquestra a criação e armazenamento; a geração da imagem da carteirinha é delegada ao serviço externo.

> **Nota de desenvolvimento:** O endpoint `GET /license/health` tem um comentário no código-fonte indicando investigação pendente sobre a necessidade de mantê-lo restrito apenas ao ADMIN. O comportamento atual (somente ADMIN) está documentado aqui.

---

## POST /license/create

Emite uma nova carteirinha para um estudante.

**Roles:** EMPLOYEE, ADMIN

### Body

| Campo | Tipo | Obrigatório | Validações |
|---|---|---|---|
| `id` | `string` | Sim | MongoDB ObjectId do estudante |
| `name` | `string` | Sim | Nome na carteirinha; máx. 100 chars |
| `degree` | `string` | Sim | Série/curso; máx. 100 chars |
| `institution` | `string` | Sim | Nome da instituição; máx. 100 chars |
| `shift` | `Shift` | Sim | `Matutino`, `Vespertino`, `Noturno` ou `Integral` |
| `telephone` | `string` | Sim | 10–15 chars (aceita `+`, espaços, hífens, parênteses) |
| `blood_type` | `BloodType` | Sim | Ex: `O+`, `A-`, `AB+` (ver enum em [students.md](./students.md)) |
| `bus` | `string` | Sim | Linha do ônibus; máx. 100 chars |
| `photo` | `string` | Sim | Data URL base64 (`data:image/jpeg;base64,...`); máx. ~2MB; formatos: jpeg, jpg, png, webp |

### Respostas

| Status | Descrição |
|---|---|
| `201` | Carteirinha criada com sucesso |
| `400` | Dados inválidos (foto em formato errado, campos ausentes) |
| `401` | Token ausente ou inválido |
| `403` | Role insuficiente |

### Exemplo

```bash
curl -X POST https://api.vrgtransport.com.br/api/v1/license/create \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "id": "64f3a1b2c3d4e5f6a7b8c9d0",
    "name": "Maria Silva",
    "degree": "3º Ano Ensino Médio",
    "institution": "Escola Estadual João Paulo",
    "shift": "Matutino",
    "telephone": "11987654321",
    "blood_type": "O+",
    "bus": "Linha 42",
    "photo": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA..."
  }'
```

```json
{
  "_id": "64f3a1b2c3d4e5f6a7b8c9e0",
  "studentId": "64f3a1b2c3d4e5f6a7b8c9d0",
  "name": "Maria Silva",
  "degree": "3º Ano Ensino Médio",
  "institution": "Escola Estadual João Paulo",
  "shift": "Matutino",
  "createdAt": "2024-03-15T14:30:00.000Z"
}
```

---

## GET /license/health

Verifica a disponibilidade do serviço externo de geração de carteirinhas.

**Roles:** ADMIN

> Comentário no código-fonte: `// INVESTIGAR SE VAI NECESSARIO MANTER PROTEGIDO POR ROLE ADMIN` — o acesso pode ser revisado em versões futuras.

### Respostas

| Status | Descrição |
|---|---|
| `200` | Serviço externo disponível |
| `401` | Token ausente ou inválido |
| `403` | Role não é ADMIN |

### Exemplo

```bash
curl https://api.vrgtransport.com.br/api/v1/license/health \
  -H "Authorization: Bearer eyJ..."
```

```json
{ "status": "ok" }
```

---

## GET /license/all

Lista todas as licenças emitidas.

**Roles:** EMPLOYEE, ADMIN

### Respostas

| Status | Descrição |
|---|---|
| `200` | Array de licenças |
| `401` | Token ausente ou inválido |
| `403` | Role insuficiente |

### Exemplo

```bash
curl https://api.vrgtransport.com.br/api/v1/license/all \
  -H "Authorization: Bearer eyJ..."
```

---

## GET /license/searchByStudent/:studentId

Busca todas as licenças emitidas para um estudante.

**Roles:** EMPLOYEE, ADMIN  
**Parâmetro:** `:studentId` — MongoDB ObjectId do estudante

### Respostas

| Status | Descrição |
|---|---|
| `200` | Array de licenças do estudante (pode ser vazio) |
| `400` | ID inválido |
| `401` | Token ausente ou inválido |
| `403` | Role insuficiente |

### Exemplo

```bash
curl https://api.vrgtransport.com.br/api/v1/license/searchByStudent/64f3a1b2c3d4e5f6a7b8c9d0 \
  -H "Authorization: Bearer eyJ..."
```

---

## GET /license/:id

Retorna uma licença pelo ID.

**Roles:** EMPLOYEE, ADMIN  
**Parâmetro:** `:id` — MongoDB ObjectId da licença

### Respostas

| Status | Descrição |
|---|---|
| `200` | Dados da licença |
| `400` | ID inválido |
| `401` | Token ausente ou inválido |
| `403` | Role insuficiente |
| `404` | Licença não encontrada |

### Exemplo

```bash
curl https://api.vrgtransport.com.br/api/v1/license/64f3a1b2c3d4e5f6a7b8c9e0 \
  -H "Authorization: Bearer eyJ..."
```

---

## PATCH /license/update/:id

Atualiza os dados de uma licença existente.

**Roles:** EMPLOYEE, ADMIN  
**Parâmetro:** `:id` — MongoDB ObjectId da licença

### Body

Mesmos campos de `POST /license/create` (todos opcionais no update).

### Respostas

| Status | Descrição |
|---|---|
| `200` | Licença atualizada |
| `400` | ID inválido ou dados inválidos |
| `401` | Token ausente ou inválido |
| `403` | Role insuficiente |
| `404` | Licença não encontrada |

### Exemplo

```bash
curl -X PATCH https://api.vrgtransport.com.br/api/v1/license/update/64f3a1b2c3d4e5f6a7b8c9e0 \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"degree": "Técnico em Informática", "shift": "Noturno"}'
```

---

## DELETE /license/delete/:id

Remove permanentemente uma licença.

**Roles:** ADMIN  
**Parâmetro:** `:id` — MongoDB ObjectId da licença

### Respostas

| Status | Descrição |
|---|---|
| `200` | Licença removida |
| `400` | ID inválido |
| `401` | Token ausente ou inválido |
| `403` | Role não é ADMIN |
| `404` | Licença não encontrada |

### Exemplo

```bash
curl -X DELETE https://api.vrgtransport.com.br/api/v1/license/delete/64f3a1b2c3d4e5f6a7b8c9e0 \
  -H "Authorization: Bearer eyJ..."
```

---

## Sobre a Foto (campo `photo`)

O campo `photo` deve ser uma **Data URL base64** completa, incluindo o prefixo MIME:

```
data:image/jpeg;base64,/9j/4AAQ...
data:image/png;base64,iVBORw0KGgo...
data:image/webp;base64,UklGRl...
```

**Limites:**
- Tamanho máximo: ~2MB (limitado pelo body parser do Express em 2MB)
- A carteirinha impressa usa tipicamente fotos 3x4 (~150–300KB) — enviar fotos menores melhora a performance

**Formatos aceitos:** `image/jpeg`, `image/jpg`, `image/png`, `image/webp`
