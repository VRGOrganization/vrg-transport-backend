# API Reference - Images

Base: /api/v1/image

## PhotoType

Valores aceitos:

- ProfilePhoto
- EnrollmentProof
- CourseSchedule
- LicenseImage

## POST /image

Cria imagem para estudante.

Roles: EMPLOYEE, ADMIN

## GET /image

Lista paginada de imagens ativas.

Roles: EMPLOYEE, ADMIN

Query:

- page (default 1)
- limit (default 20, max 100)

## POST /image/me

Estudante cria imagem propria.

Role: STUDENT

## GET /image/me

Lista imagens do estudante autenticado.

Role: STUDENT

## GET /image/me/profile

Retorna foto de perfil do estudante autenticado.

Role: STUDENT

## GET /image/student/me

Alias para listar imagens do proprio estudante.

Role: STUDENT

## GET /image/history/student/:studentId

Historico de imagens arquivadas do estudante.

Roles: EMPLOYEE, ADMIN

## GET /image/student/:studentId

Lista imagens ativas de um estudante.

Roles: EMPLOYEE, ADMIN

## GET /image/:id/file

Retorna payload completo do arquivo da imagem para o dono.

Role: STUDENT

## GET /image/:id

Busca imagem por id.

Roles: EMPLOYEE, ADMIN

## PATCH /image/student/:studentId/profile

Atualiza foto de perfil por studentId.

Roles: EMPLOYEE, ADMIN

## PATCH /image/:id

Atualiza imagem por id.

Roles: EMPLOYEE, ADMIN

## DELETE /image/student/:studentId

Desativa imagens de um estudante.

Role: ADMIN

## DELETE /image/:id

Desativa imagem por id.

Role: ADMIN
