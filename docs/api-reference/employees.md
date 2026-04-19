# API Reference - Employees

Base: `/api/v1/employee`

Todos os endpoints exigem `ADMIN`.

## POST /employee

Cria um funcion?rio.

Body:

```json
{
  "name": "Maria Souza",
  "email": "maria@prefeitura.gov.br",
  "registrationId": "EMP001",
  "password": "Senha123"
}
```

Regras:
- `email` e `registrationId` precisam ser ?nicos.
- a senha segue a pol?tica centralizada do backend.

Respostas: `201`, `400`, `409`

## GET /employee

Lista os funcion?rios ativos.

Respostas: `200`

## GET /employee/inactive

Lista os funcion?rios inativos.

Respostas: `200`

## GET /employee/:id

Busca um funcion?rio por ID.

Respostas: `200`, `400`, `404`

## PATCH /employee/:id

Atualiza um funcion?rio por ID.

Body parcial permitido.

Respostas: `200`, `400`, `404`

## DELETE /employee/:id

Desativa um funcion?rio com soft delete.

Respostas: `200`, `400`, `404`
