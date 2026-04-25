# API Reference - Courses

Base: `/api/v1/course`

Todos os endpoints exigem `ADMIN`.

## POST /course

Cria um curso vinculado a uma faculdade.

Body:

```json
{
  "name": "Psicologia",
  "universityId": "6650a2f..."
}
```

Regras:
- `name` ? normalizado com `trim`;
- `universityId` precisa existir;
- o backend evita duplicidade de curso na mesma faculdade.

Respostas: `201`, `400`, `404`, `409`

## GET /course

Lista os cursos ativos.

Respostas: `200`

## GET /course/inactive

Lista os cursos inativos.

Respostas: `200`

## GET /course/by-university/:universityId

Lista os cursos ativos de uma faculdade.

Roles: `ADMIN`, `STUDENT`

## GET /course/:id

Busca um curso por ID.

Respostas: `200`, `400`, `404`

## PATCH /course/:id

Atualiza um curso.

Body parcial permitido.

Observa??o:
- o `universityId` n?o ? alterado por esse endpoint.

Respostas: `200`, `400`, `404`

## DELETE /course/:id

Desativa um curso com soft delete.

Respostas: `200`, `400`, `404`
