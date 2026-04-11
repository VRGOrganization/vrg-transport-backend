# API Reference - Licenses

Base: /api/v1/license

## POST /license/events/token

Emite ticket efemero para SSE.

Role: STUDENT

Resposta:

{
  "ticket": "uuid",
  "expiresInMs": 60000
}

## GET /license/events?ticket=...

Canal SSE publico protegido por ticket de uso unico.

Eventos:

- connected
- heartbeat
- license.changed (created, updated, removed, rejected, waitlist_promoted)

## GET /license/verify/:code

Verificacao publica por codigo.

Resposta tipica:

{
  "exists": true,
  "valid": true,
  "status": "active"
}

## POST /license/create

Emite carteirinha manualmente.

Role: ADMIN

Pre-condicao: estudante com solicitacao approved.

Respostas: 201, 400, 404, 502, 504

## GET /license/health

Healthcheck do emissor externo.

Roles: EMPLOYEE, ADMIN

## GET /license/all

Lista licencas existentes.

Roles: EMPLOYEE, ADMIN

## GET /license/searchByStudent/:studentId

Busca licenca por estudante.

Roles: EMPLOYEE, ADMIN

## GET /license/me

Busca licenca do estudante autenticado.

Role: STUDENT

## GET /license/:id

Busca licenca por id.

Roles: EMPLOYEE, ADMIN

## PATCH /license/update/:id

Atualiza licenca (gera nova e desativa anterior).

Roles: EMPLOYEE, ADMIN

## PATCH /license/reject/:id

Marca licenca como rejected e envia notificacao.

Roles: EMPLOYEE, ADMIN

## DELETE /license/delete/:id

Desativa licenca por id (soft delete funcional).

Role: ADMIN
