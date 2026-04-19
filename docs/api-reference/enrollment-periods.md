# API Reference - Enrollment Periods

Base: `/api/v1/enrollment-period`

Todos os endpoints exigem `ADMIN`, exceto a consulta do per?odo ativo.

## POST /enrollment-period

Cria um novo per?odo de inscri??o.

Body:

```json
{
  "startDate": "2026-04-01T00:00:00.000Z",
  "endDate": "2026-12-31T23:59:59.000Z",
  "totalSlots": 100,
  "licenseValidityMonths": 6
}
```

Regras importantes:
- se existir per?odo ativo com janela vencida, ele ? finalizado antes da cria??o;
- a finaliza??o encerra a fila `waitlisted` do per?odo antigo;
- conflito com outro per?odo ativo retorna `409`.

Respostas: `201`, `400`, `409`

## GET /enrollment-period

Lista os per?odos.

Role: `ADMIN`

## GET /enrollment-period/active

Retorna o per?odo ativo.

Roles: `STUDENT`, `EMPLOYEE`, `ADMIN`

Observa??o:
- se o per?odo ativo j? estiver vencido, ele ? finalizado no fluxo e a chamada retorna aus?ncia de ativo.

## PATCH /enrollment-period/:id

Atualiza um per?odo.

Body parcial permitido:

```json
{
  "startDate": "2026-04-01T00:00:00.000Z",
  "endDate": "2026-12-31T23:59:59.000Z",
  "totalSlots": 120,
  "licenseValidityMonths": 7
}
```

Regras importantes:
- alterar `licenseValidityMonths` ajusta a expira??o das licen?as ativas vinculadas ao per?odo;
- licen?as que ficarem vencidas ap?s o ajuste s?o desativadas.

Respostas: `200`, `400`, `404`, `409`

## PATCH /enrollment-period/:id/close

Encerra o per?odo explicitamente.

Regras importantes:
- encerra a fila `waitlisted` em lote;
- grava o hist?rico da fila encerrada no pr?prio per?odo.

Respostas: `200`, `404`

## PATCH /enrollment-period/:id/reopen

Reabre um per?odo encerrado.

Regras:
- n?o permite reabrir per?odo com janela vencida;
- n?o permite reabrir se j? existir outro per?odo ativo.

Respostas: `200`, `400`, `404`, `409`

## GET /enrollment-period/:id/waitlist

Lista a fila `waitlisted` do per?odo, j? ordenada.

Role: `ADMIN`

## POST /enrollment-period/:id/release-slots

Pr?-visualiza solicita??es a promover da fila.

Body:

```json
{
  "quantity": 3
}
```

Role: `ADMIN`

## POST /enrollment-period/:id/confirm-release

Confirma a promo??o de `requestIds` da fila para `pending`.

Body:

```json
{
  "requestIds": ["...", "..."]
}
```

Regras:
- IDs duplicados no payload retornam `400`;
- a promo??o ? tratada request a request;
- em corrida, requests j? processadas entram como `skipped` na auditoria.

Respostas: `200`, `400`, `404`, `409`
