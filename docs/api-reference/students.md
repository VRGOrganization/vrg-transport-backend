# API Reference - Students

Base: `/api/v1/student`

## `GET /student`

Lista estudantes ativos com paginação.

Roles: `ADMIN`, `EMPLOYEE`

## `GET /student/inactive`

Lista estudantes inativos.

Roles: `ADMIN`, `EMPLOYEE`

## `POST /student/schedule`

Atualiza a grade horária do estudante autenticado.

Role: `STUDENT`

## `POST /student/me/license-submit`

Fluxo principal de inscrição inicial.

Role: `STUDENT`

Multipart esperado:

- `institution`
- `degree`
- `shift`
- `bloodType`
- `schedule` (JSON string)
- `ProfilePhoto`
- `EnrollmentProof`
- `CourseSchedule`

Comportamento:

- atualiza perfil e imagens
- cria request initial em fluxo centralizado no service
- direciona ônibus por faculdade + turno
- para `Integral`, prioriza ônibus da `Manhã`

## `POST /student/me/document-update-request`

Solicita atualização de documentos após a aprovação inicial.

## `PATCH /student/me/photo`

Atualiza foto de perfil.

## `DELETE /student/me/photo`

Remove foto de perfil.

## `GET /student/me`

Retorna o perfil do estudante autenticado.

## `GET /student/stats/dashboard`

Estatísticas agregadas para operação.

## `GET /student/:id`

Busca estudante por ID.

## `PATCH /student/me`

Atualiza o próprio perfil.

## `PATCH /student/:id`

Atualiza estudante por ID.

## `DELETE /student/:id`

Remove estudante por ID.
