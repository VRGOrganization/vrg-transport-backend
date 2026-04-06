# API Reference — Images

Base: `/api/v1/image`  
Todos os endpoints requerem autenticação por sessão (x-session-id).

As imagens são armazenadas em base64 em uma **conexão MongoDB separada** (`MONGODB_URI_IMAGE`). O serviço valida o MIME type declarado conferindo os bytes mágicos reais da imagem (JPEG: `0xFF 0xD8 0xFF`; PNG: `0x89 0x50 0x4E 0x47`; WebP: `RIFF...WEBP`).

---

## PhotoType

| Valor | Descrição |
|---|---|
| `ProfilePhoto` | Foto 3x4 do estudante — em uso |
| `LicenseImage` | Imagem gerada da carteirinha — não utilizado atualmente |

---

## POST /image

Cria uma nova imagem para um estudante.

**Roles:** EMPLOYEE, ADMIN

### Body

| Campo | Tipo | Obrigatório | Validações |
|---|---|---|---|
| `studentId` | `string` | Sim | MongoDB ObjectId do estudante |
| `photoType` | `PhotoType` | Sim | `ProfilePhoto` ou `LicenseImage` |
| `photo3x4` | `string` | Condicional | Obrigatório quando `photoType = ProfilePhoto`; Data URL base64; máx. 2MB; formatos: jpeg, jpg, png, webp |

### Respostas

| Status | Descrição |
|---|---|
| `201` | Imagem criada |
| `400` | Dados inválidos (MIME type incorreto, bytes inválidos, campo ausente) |
| `401` | Sessão ausente ou inválida |
| `403` | Role insuficiente |

### Exemplo

```bash
curl -X POST https://api.vrgtransport.com.br/api/v1/image \
  -H "x-session-id: <session-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "64f3a1b2c3d4e5f6a7b8c9d0",
    "photoType": "ProfilePhoto",
    "photo3x4": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA..."
  }'
```

```json
{
  "_id": "64f3a1b2c3d4e5f6a7b8c9f0",
  "studentId": "64f3a1b2c3d4e5f6a7b8c9d0",
  "photoType": "ProfilePhoto",
  "active": true,
  "createdAt": "2024-03-15T14:30:00.000Z"
}
```

---

## GET /image

Lista todas as imagens ativas.

**Roles:** EMPLOYEE, ADMIN

### Respostas

| Status | Descrição |
|---|---|
| `200` | Array de imagens |
| `401` | Sessão ausente ou inválida |
| `403` | Role insuficiente |

### Exemplo

```bash
curl https://api.vrgtransport.com.br/api/v1/image \
  -H "x-session-id: <session-id>"
```

---

## GET /image/me

Retorna todas as imagens ativas do estudante autenticado.

**Roles:** STUDENT (somente as próprias imagens)

### Respostas

| Status | Descrição |
|---|---|
| `200` | Array de imagens do estudante |
| `401` | Sessão ausente ou inválida |
| `403` | Role não é STUDENT |

### Exemplo

```bash
curl https://api.vrgtransport.com.br/api/v1/image/me \
  -H "x-session-id: <session-id>"
```

```json
[
  {
    "_id": "64f3a1b2c3d4e5f6a7b8c9f0",
    "studentId": "64f3a1b2c3d4e5f6a7b8c9d0",
    "photoType": "ProfilePhoto",
    "photo3x4": "data:image/jpeg;base64,/9j/4AAQ...",
    "active": true
  }
]
```

---

## GET /image/me/profile

Retorna a foto de perfil (`ProfilePhoto`) do estudante autenticado.

**Roles:** STUDENT (somente o próprio perfil)

### Respostas

| Status | Descrição |
|---|---|
| `200` | Imagem de perfil |
| `401` | Sessão ausente ou inválida |
| `403` | Role não é STUDENT |
| `404` | Foto de perfil não encontrada |

### Exemplo

```bash
curl https://api.vrgtransport.com.br/api/v1/image/me/profile \
  -H "x-session-id: <session-id>"
```

```json
{
  "_id": "64f3a1b2c3d4e5f6a7b8c9f0",
  "studentId": "64f3a1b2c3d4e5f6a7b8c9d0",
  "photoType": "ProfilePhoto",
  "photo3x4": "data:image/jpeg;base64,/9j/4AAQ...",
  "active": true
}
```

---

## GET /image/student/:studentId

Retorna todas as imagens ativas de um estudante específico.

**Roles:** EMPLOYEE, ADMIN  
**Parâmetro:** `:studentId` — MongoDB ObjectId do estudante

### Respostas

| Status | Descrição |
|---|---|
| `200` | Array de imagens do estudante |
| `400` | ID inválido |
| `401` | Sessão ausente ou inválida |
| `403` | Role insuficiente |
| `404` | Estudante não encontrado |

### Exemplo

```bash
curl https://api.vrgtransport.com.br/api/v1/image/student/64f3a1b2c3d4e5f6a7b8c9d0 \
  -H "x-session-id: <session-id>"
```

---

## GET /image/:id

Retorna uma imagem pelo ID.

**Roles:** EMPLOYEE, ADMIN  
**Parâmetro:** `:id` — MongoDB ObjectId da imagem

### Respostas

| Status | Descrição |
|---|---|
| `200` | Dados da imagem |
| `400` | ID inválido |
| `401` | Sessão ausente ou inválida |
| `403` | Role insuficiente |
| `404` | Imagem não encontrada |

### Exemplo

```bash
curl https://api.vrgtransport.com.br/api/v1/image/64f3a1b2c3d4e5f6a7b8c9f0 \
  -H "x-session-id: <session-id>"
```

---

## PATCH /image/student/:studentId/profile

Atualiza a foto de perfil de um estudante.

**Roles:** EMPLOYEE, ADMIN  
**Parâmetro:** `:studentId` — MongoDB ObjectId do estudante

### Body

| Campo | Tipo | Obrigatório | Validações |
|---|---|---|---|
| `photo3x4` | `string` | Não | Data URL base64; máx. 2MB; formatos: jpeg, jpg, png, webp |

### Respostas

| Status | Descrição |
|---|---|
| `200` | Foto de perfil atualizada |
| `400` | ID inválido ou imagem inválida |
| `401` | Sessão ausente ou inválida |
| `403` | Role insuficiente |
| `404` | Estudante ou foto de perfil não encontrada |

### Exemplo

```bash
curl -X PATCH https://api.vrgtransport.com.br/api/v1/image/student/64f3a1b2c3d4e5f6a7b8c9d0/profile \
  -H "x-session-id: <session-id>" \
  -H "Content-Type: application/json" \
  -d '{"photo3x4": "data:image/jpeg;base64,/9j/4AAQ..."}'
```

---

## PATCH /image/:id

Atualiza uma imagem pelo ID.

**Roles:** EMPLOYEE, ADMIN  
**Parâmetro:** `:id` — MongoDB ObjectId da imagem

### Body

| Campo | Tipo | Obrigatório | Validações |
|---|---|---|---|
| `photo3x4` | `string` | Não | Data URL base64; máx. 2MB; formatos: jpeg, jpg, png, webp |

### Respostas

| Status | Descrição |
|---|---|
| `200` | Imagem atualizada |
| `400` | ID inválido ou imagem inválida |
| `401` | Sessão ausente ou inválida |
| `403` | Role insuficiente |
| `404` | Imagem não encontrada |

### Exemplo

```bash
curl -X PATCH https://api.vrgtransport.com.br/api/v1/image/64f3a1b2c3d4e5f6a7b8c9f0 \
  -H "x-session-id: <session-id>" \
  -H "Content-Type: application/json" \
  -d '{"photo3x4": "data:image/png;base64,iVBORw0KGgo..."}'
```

---

## DELETE /image/student/:studentId

Remove (soft delete) todas as imagens de um estudante.

**Roles:** ADMIN  
**Parâmetro:** `:studentId` — MongoDB ObjectId do estudante

### Respostas

| Status | Descrição |
|---|---|
| `200` | Todas as imagens do estudante desativadas |
| `400` | ID inválido |
| `401` | Sessão ausente ou inválida |
| `403` | Role não é ADMIN |
| `404` | Estudante não encontrado |

### Exemplo

```bash
curl -X DELETE https://api.vrgtransport.com.br/api/v1/image/student/64f3a1b2c3d4e5f6a7b8c9d0 \
  -H "x-session-id: <session-id>"
```

---

## DELETE /image/:id

Remove (soft delete) uma imagem específica pelo ID.

**Roles:** ADMIN  
**Parâmetro:** `:id` — MongoDB ObjectId da imagem

### Respostas

| Status | Descrição |
|---|---|
| `200` | Imagem desativada |
| `400` | ID inválido |
| `401` | Sessão ausente ou inválida |
| `403` | Role não é ADMIN |
| `404` | Imagem não encontrada |

### Exemplo

```bash
curl -X DELETE https://api.vrgtransport.com.br/api/v1/image/64f3a1b2c3d4e5f6a7b8c9f0 \
  -H "x-session-id: <session-id>"
```

---

## Validação de Imagem

O `ImageService` valida a imagem em dois níveis:

1. **MIME type declarado:** O prefixo da Data URL deve ser um dos tipos aceitos (`image/jpeg`, `image/jpg`, `image/png`, `image/webp`)
2. **Bytes mágicos:** O conteúdo base64 decodificado é inspecionado para confirmar que os bytes iniciais correspondem ao formato declarado:
   - JPEG: `FF D8 FF`
   - PNG: `89 50 4E 47 0D 0A 1A 0A`
   - WebP: `52 49 46 46 ... 57 45 42 50` (RIFF...WEBP)

Essa dupla validação evita que arquivos com extensão renomeada sejam aceitos.

