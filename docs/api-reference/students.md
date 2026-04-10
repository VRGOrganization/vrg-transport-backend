# API Reference — Students

Base: `/api/v1/student`

## GET /student

Lista paginada de estudantes.

Roles: `EMPLOYEE`, `ADMIN`

Query params opcionais:

- `page` (default `1`)
- `limit` (default `20`, máximo `100`)

Retorno:

```json
{
  "data": [],
  "total": 0,
  "page": 1,
  "limit": 20
}
```

## POST /student/schedule

Salva grade horária do estudante autenticado.

Roles: `STUDENT`

Body:

```json
{
  "selections": [
    { "day": "SEG", "period": "Manhã" },
    { "day": "TER", "period": "Noite" }
  ]
}
```

## POST /student/me/license-submit

Envia dados + documentos em multipart para solicitação inicial.

Roles: `STUDENT`

Content-Type: `multipart/form-data`

Campos:

- `institution` (opcional)
- `degree` (opcional)
- `shift` (opcional)
- `bloodType` (opcional)
- `schedule` (obrigatório, JSON string)
- `ProfilePhoto` (arquivo opcional)
- `EnrollmentProof` (arquivo opcional)
- `CourseSchedule` (arquivo opcional)

Limite de arquivo por campo: 10MB.

## POST /student/me/document-update-request

Solicita alteração de documentos após aprovação inicial.

Roles: `STUDENT`

Content-Type: `multipart/form-data`

Campos:

- `changedDocuments` (obrigatório, JSON string com `PhotoType[]`)
- arquivos correspondentes aos tipos enviados

## PATCH /student/me/photo

Atualiza foto de perfil do estudante autenticado.

Roles: `STUDENT`

Content-Type: `multipart/form-data`

Campo:

- `photo` (obrigatório)

## DELETE /student/me/photo

Remove foto de perfil do estudante autenticado.

Roles: `STUDENT`

## GET /student/me

Retorna perfil do estudante autenticado com `photo` agregado.

Roles: `STUDENT`

## GET /student/stats/dashboard

Retorna estatísticas agregadas de estudantes.

Roles: `EMPLOYEE`, `ADMIN`

Retorno exemplo:

```json
{
  "totalStudents": 120,
  "studentsWithCard": 45,
  "studentsWithoutCard": 30,
  "studentsWithPendingRequest": 45,
  "transport": {
    "totalUsing": 90,
    "byShift": {
      "morning": 40,
      "afternoon": 25,
      "night": 15,
      "fullTime": 10
    },
    "byDay": {
      "SEG": 85,
      "TER": 80,
      "QUA": 78,
      "QUI": 82,
      "SEX": 60
    }
  },
  "generatedAt": "2026-04-10T12:00:00.000Z"
}
```

## GET /student/:id

Busca estudante por ID.

Roles: `EMPLOYEE`, `ADMIN`

## PATCH /student/me

Atualiza perfil do estudante autenticado.

Roles: `STUDENT`

## PATCH /student/:id

Atualiza estudante por ID.

Roles: `EMPLOYEE`, `ADMIN`

## DELETE /student/:id

Remove estudante por ID.

Roles: `ADMIN`
