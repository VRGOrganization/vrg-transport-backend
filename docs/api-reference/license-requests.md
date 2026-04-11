# API Reference - License Requests

Base: /api/v1/license-request

## Conceitos

- type
  - initial: primeira solicitacao
  - update: alteracao de documentos

- status
  - pending
  - approved
  - rejected
  - cancelled
  - waitlisted

## GET /license-request/all

Lista todas as solicitacoes.

Roles: EMPLOYEE, ADMIN

## GET /license-request/pending

Lista solicitacoes pendentes.

Roles: EMPLOYEE, ADMIN

## GET /license-request/me

Retorna solicitacao mais recente do estudante autenticado.

Role: STUDENT

## GET /license-request/student/:studentId

Lista solicitacoes de um estudante.

Roles: EMPLOYEE, ADMIN

## PATCH /license-request/approve/:id

Aprova solicitacao pendente.

Roles: EMPLOYEE, ADMIN

Body:

{
  "bus": "205",
  "institution": "Universidade Federal Fluminense",
  "photo": "data:image/jpeg;base64,..."
}

Comportamento:

- initial
  - valida vaga com incremento atomico no periodo
  - cria licenca vinculada ao enrollmentPeriodId da solicitacao
  - usa licenseValidityMonths do periodo
  - em erro, faz rollback da vaga reservada

- update
  - regenera licenca existente
  - arquiva imagens antigas e aplica pendencias

Respostas: 200, 400, 404, 409

## PATCH /license-request/reject/:id

Rejeita solicitacao pendente.

Roles: EMPLOYEE, ADMIN

Body:

{
  "reason": "Documentos ilegiveis ou corrompidos"
}

Respostas: 200, 400, 404
