# API Reference - Students

Base: /api/v1/student

## GET /student

Lista paginada de estudantes.

Roles: EMPLOYEE, ADMIN

Query:

- page (default 1)
- limit (default 20, max 100)

## POST /student/schedule

Atualiza grade horaria do estudante autenticado.

Role: STUDENT

Body:

{
  "selections": [
    { "day": "SEG", "period": "Manha" },
    { "day": "TER", "period": "Noite" }
  ]
}

## POST /student/me/license-submit

Submit inicial (perfil + horario + documentos) em multipart.

Role: STUDENT

Campos:

- institution
- degree
- shift
- bloodType
- schedule (obrigatorio, JSON string)
- ProfilePhoto (arquivo)
- EnrollmentProof (arquivo)
- CourseSchedule (arquivo)

Comportamento:

- valida elegibilidade inicial antes de gravar side effects
- cria solicitacao initial:
  - pending se houver vaga
  - waitlisted se nao houver vaga

## POST /student/me/document-update-request

Solicita update de documentos apos aprovacao inicial.

Role: STUDENT

Campos:

- changedDocuments (JSON string)
- arquivos correspondentes

## PATCH /student/me/photo

Atualiza foto de perfil do estudante autenticado.

Role: STUDENT

## DELETE /student/me/photo

Remove foto de perfil do estudante autenticado.

Role: STUDENT

## GET /student/me

Retorna perfil do estudante autenticado.

Role: STUDENT

## GET /student/stats/dashboard

Estatisticas agregadas para operacao.

Roles: EMPLOYEE, ADMIN

## GET /student/:id

Busca estudante por id.

Roles: EMPLOYEE, ADMIN

## PATCH /student/me

Atualiza proprio perfil.

Role: STUDENT

## PATCH /student/:id

Atualiza estudante por id.

Roles: EMPLOYEE, ADMIN

## DELETE /student/:id

Remove estudante por id.

Role: ADMIN
