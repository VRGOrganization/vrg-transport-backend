# API Reference - Universities

Base: `/api/v1/university`

Todos os endpoints exigem `ADMIN`.

## POST /university

Cria uma faculdade.

Body:

```json
{
  "name": "Universidade Federal Fluminense",
  "acronym": "UFF",
  "address": "Rua Miguel de Frias, 9 - Icara?, Niter?i - RJ"
}
```

Regras:
- `acronym` ? salvo em mai?sculas;
- `name` e `address` passam por `trim`;
- a sigla precisa ser ?nica.

Respostas: `201`, `400`, `409`

## GET /university

Lista as faculdades ativas.

Respostas: `200`

## GET /university/inactive

Lista as faculdades inativas.

Respostas: `200`

## GET /university/:id

Busca uma faculdade por ID.

Respostas: `200`, `400`, `404`

## PATCH /university/:id

Atualiza uma faculdade.

Body parcial permitido.

Respostas: `200`, `400`, `404`, `409`

## DELETE /university/:id

Desativa uma faculdade com soft delete.

Respostas: `200`, `400`, `404`
