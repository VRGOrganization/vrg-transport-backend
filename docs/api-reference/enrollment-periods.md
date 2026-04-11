# API Reference - Enrollment Period

Base: /api/v1/enrollment-period

Todos endpoints exigem ADMIN, exceto consulta de ativo.

## POST /enrollment-period

Cria novo periodo de inscricao.

Body:

{
  "startDate": "2026-04-01T00:00:00.000Z",
  "endDate": "2026-12-31T23:59:59.000Z",
  "totalSlots": 100,
  "licenseValidityMonths": 6
}

Comportamento importante:

- se existir periodo ativo com janela vencida, o sistema finaliza esse periodo
- finalizacao encerra fila waitlisted do periodo antigo
- conflito de ativo em create retorna 409

Respostas: 201, 400, 409

## GET /enrollment-period

Lista periodos.

Role: ADMIN

## GET /enrollment-period/active

Retorna periodo ativo.

Roles: STUDENT, EMPLOYEE, ADMIN

Observacao:

- se o periodo ativo ja estiver vencido, ele e finalizado no fluxo e a chamada retorna ausencia de ativo

## PATCH /enrollment-period/:id

Atualiza periodo.

Body parcial permitido:

{
  "startDate": "2026-04-01T00:00:00.000Z",
  "endDate": "2026-12-31T23:59:59.000Z",
  "totalSlots": 120,
  "licenseValidityMonths": 7
}

Comportamento importante:

- alterar licenseValidityMonths ajusta expiracao das licencas ativas vinculadas ao periodo
- licencas que ficarem vencidas apos ajuste sao desativadas

Respostas: 200, 400, 404, 409

## PATCH /enrollment-period/:id/close

Encerra periodo explicitamente.

Comportamento importante:

- encerra fila waitlisted em lote
- grava historico da fila encerrada no proprio periodo

Respostas: 200, 404

## PATCH /enrollment-period/:id/reopen

Reabre periodo encerrado.

Regras:

- nao permite reabrir periodo com janela vencida
- nao permite se ja existir outro periodo ativo

Respostas: 200, 400, 404, 409

## GET /enrollment-period/:id/waitlist

Lista fila waitlisted do periodo (ordenada).

Role: ADMIN

## POST /enrollment-period/:id/release-slots

Preview de solicitacoes a promover da fila.

Body:

{
  "quantity": 3
}

Role: ADMIN

## POST /enrollment-period/:id/confirm-release

Confirma promocao de requestIds da fila para pending.

Body:

{
  "requestIds": ["...", "..."]
}

Regras:

- IDs duplicados no payload retornam 400
- promocao e atomica por request
- em corrida, requests ja processadas entram como skipped na auditoria

Respostas: 200, 400, 404, 409
