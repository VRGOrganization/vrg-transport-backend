# API Reference — Images

Base: `/api/v1/image`

## PhotoType

Valores aceitos:

- `ProfilePhoto`
- `EnrollmentProof`
- `CourseSchedule`
- `LicenseImage`

## POST /image

Cria imagem para estudante.

Roles: `EMPLOYEE`, `ADMIN`

Body:

```json
{
  "studentId": "...",
  "photoType": "ProfilePhoto",
  "photo3x4": "data:image/jpeg;base64,..."
}
```

Regras:

- `ProfilePhoto` exige `photo3x4`
- `EnrollmentProof` e `CourseSchedule` exigem `documentImage`
- valida Data URL e assinatura binária do arquivo

## GET /image

Lista paginada de imagens ativas.

Roles: `EMPLOYEE`, `ADMIN`

Query params opcionais:

- `page` (default `1`)
- `limit` (default `20`, máximo `100`)

## POST /image/me

Estudante cria imagem própria.

Roles: `STUDENT`

Body igual ao `POST /image`, sem `studentId`.

## GET /image/me

Lista imagens do estudante autenticado.

Roles: `STUDENT`

## GET /image/me/profile

Retorna foto de perfil do estudante autenticado.

Roles: `STUDENT`

## GET /image/student/me

Alias de listagem para o estudante autenticado.

Roles: `STUDENT`

Retorna versão resumida por imagem, incluindo `hasFile`.

## GET /image/history/student/:studentId

Histórico de versões arquivadas.

Roles: `EMPLOYEE`, `ADMIN`

## GET /image/student/:studentId

Lista imagens ativas do estudante.

Roles: `EMPLOYEE`, `ADMIN`

## GET /image/:id/file

Retorna payload completo do arquivo para imagem do próprio estudante.

Roles: `STUDENT`

Se imagem não pertence ao estudante autenticado, responde `403`.

## GET /image/:id

Busca imagem por ID.

Roles: `EMPLOYEE`, `ADMIN`

## PATCH /image/student/:studentId/profile

Atualiza foto de perfil por estudante.

Roles: `EMPLOYEE`, `ADMIN`

## PATCH /image/:id

Atualiza imagem por ID.

Roles: `EMPLOYEE`, `ADMIN`

## DELETE /image/student/:studentId

Soft delete das imagens do estudante.

Roles: `ADMIN`

## DELETE /image/:id

Soft delete por ID.

Roles: `ADMIN`
