# API Reference - Employees

Base: /api/v1/employee

Todos endpoints exigem ADMIN.

## POST /employee

Cria funcionario.

Body:

{
  "name": "Joao Ferreira",
  "email": "joao@prefeitura.gov.br",
  "registrationId": "EMP001",
  "password": "Senha123"
}

Respostas: 201, 400, 409

## GET /employee

Lista funcionarios ativos.

Respostas: 200

## GET /employee/inactive

Lista funcionarios inativos.

Respostas: 200

## GET /employee/:id

Busca funcionario por id.

Respostas: 200, 400, 404

## PATCH /employee/:id

Atualiza funcionario por id.

Respostas: 200, 400, 404

## DELETE /employee/:id

Desativa funcionario (soft delete).

Respostas: 200, 400, 404
