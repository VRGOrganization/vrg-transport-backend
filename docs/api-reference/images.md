# API Reference - Images

Base: `/api/v1/image`

## `PhotoType`

Valores aceitos:

- `ProfilePhoto`
- `EnrollmentProof`
- `CourseSchedule`
- `LicenseImage`

## POST /image

Cria uma imagem para o estudante.

Roles: `EMPLOYEE`, `ADMIN`

## GET /image

Lista as imagens ativas com pagina??o.

Roles: `EMPLOYEE`, `ADMIN`

Query:

- `page` (default `1`)
- `limit` (default `20`, max `100`)

## POST /image/me

Permite que o estudante envie a pr?pria imagem.

Role: `STUDENT`

## GET /image/me

Lista as imagens do estudante autenticado.

Role: `STUDENT`

## GET /image/me/profile

Retorna a foto de perfil do estudante autenticado.

Role: `STUDENT`

## GET /image/student/me

Alias para listar as imagens do pr?prio estudante.

Role: `STUDENT`

## GET /image/history/student/:studentId

Retorna o hist?rico de imagens arquivadas de um estudante.

Roles: `EMPLOYEE`, `ADMIN`

## GET /image/student/:studentId

Lista as imagens ativas de um estudante.

Roles: `EMPLOYEE`, `ADMIN`

## GET /image/:id/file

Retorna o payload completo do arquivo de uma imagem para o dono.

Role: `STUDENT`

## GET /image/:id

Busca uma imagem por ID.

Roles: `EMPLOYEE`, `ADMIN`

## PATCH /image/student/:studentId/profile

Atualiza a foto de perfil de um estudante pelo `studentId`

Roles: `EMPLOYEE`, `ADMIN`

## PATCH /image/:id

Atualiza uma imagem por ID.

Roles: `EMPLOYEE`, `ADMIN`

## DELETE /image/student/:studentId

Desativa as imagens de um estudante.

Role: `ADMIN`

## DELETE /image/:id

Desativa uma imagem por ID.

Role: `ADMIN`
