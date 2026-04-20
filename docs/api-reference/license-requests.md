# API Reference - License Requests

Base: `/api/v1/license-request`

## Conceitos

### `type`

- `initial`: primeira solicitação
- `update`: atualização de documentos

### `status`

- `pending`
- `approved`
- `rejected`
- `cancelled`
- `waitlisted`

### Campos úteis da request

- `busId`
- `universityId`
- `cardNote`
- `accessBusIdentifiers`
- `filaPosition`

## `GET /license-request/all`

Lista todas as solicitações.

Roles: `EMPLOYEE`, `ADMIN`

## `GET /license-request/pending`

Lista solicitações pendentes.

Roles: `EMPLOYEE`, `ADMIN`

## `GET /license-request/me`

Retorna a solicitação mais recente do estudante autenticado.

Role: `STUDENT`

## `GET /license-request/student/:studentId`

Lista solicitações de um estudante.

Roles: `EMPLOYEE`, `ADMIN`

## `PATCH /license-request/approve/:id`

Aprova uma solicitação.

Roles: `EMPLOYEE`, `ADMIN`

Body:

```json
{
  "bus": "Onibus 02",
  "institution": "Instituto Federal do Exemplo",
  "photo": "data:image/jpeg;base64,..."
}
```

### Comportamento atual

- para `initial`, o backend cria a carteirinha e atualiza a request para `approved`
- para `update`, o backend arquiva imagens antigas e regenera a carteirinha existente
- `cardNote` e `accessBusIdentifiers` seguem para a emissão da carteirinha

## `PATCH /license-request/reject/:id`

Rejeita uma solicitação.

Body:

```json
{
  "reason": "Documentos ilegíveis ou corrompidos"
}
```

## Regras de negócio

- o front não escolhe o ônibus na inscrição inicial
- o backend resolve o ônibus por faculdade + turno
- aluno `Integral` vai para ônibus da `Manhã` quando houver correspondência

## Regra de prioridade dinâmica

Ao criar ou aprovar/promover solicitações, o backend aplica a regra de prioridade dinâmica: se uma universidade de maior prioridade tem demanda ativa (status `pending` ou `waitlisted`) para um determinado ônibus, universidades de menor prioridade não devem ser aprovadas nem promovidas até que a universidade atual esgote sua demanda. Consulte [docs/invariants.md](../invariants.md) para a lista completa de invariantes.
