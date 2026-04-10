# API Reference — Employees

Base: `/api/v1/employee`

Todos os endpoints exigem role `ADMIN`.

## POST /employee

Cria funcionário.

Body:

```json
{
  "name": "João Ferreira",
  "email": "joao@prefeitura.gov.br",
  "registrationId": "EMP001",
  "password": "Senha123"
}
```

Respostas: `201`, `400`, `409`

## GET /employee

Lista funcionários ativos.

Respostas: `200`

## GET /employee/inactive

Lista funcionários inativos.

Respostas: `200`

## GET /employee/:id

Busca funcionário por ID.

Respostas: `200`, `400`, `404`

## PATCH /employee/:id

Atualiza funcionário por ID.

Campos são opcionais; senha é re-hasheada quando enviada.

Respostas: `200`, `400`, `404`

## DELETE /employee/:id

Desativa funcionário (soft delete).

Respostas: `200`, `400`, `404`
