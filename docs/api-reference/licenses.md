# API Reference - Licenses

Base: `/api/v1/license`

## `POST /license/events/token`

Emite ticket efêmero para SSE.

Role: `STUDENT`

## `GET /license/events?ticket=...`

Canal SSE protegido por ticket de uso único.

Eventos principais:

- `connected`
- `heartbeat`
- `license.changed`

## `GET /license/verify/:code`

Verificação pública por código.

## `POST /license/create`

Cria carteirinha manualmente.

Role: `ADMIN`

Pré-condição: o estudante precisa ter uma solicitação aprovada.

## `GET /license/health`

Healthcheck do serviço externo de emissão.

## `GET /license/all`

Lista licenças existentes.

## `GET /license/searchByStudent/:studentId`

Busca carteirinha por estudante.

## `GET /license/me`

Busca a carteirinha do estudante autenticado.

## `GET /license/:id`

Busca licença por ID.

## `PATCH /license/update/:id`

Atualiza carteirinha existente.

- `id` vai na rota
- o corpo é parcial

## `PATCH /license/reject/:id`

Marca a carteirinha como rejeitada.

## `DELETE /license/delete/:id`

Desativa carteirinha por ID.

## Observações

- a emissão leva o contexto da request quando ele existe
- para aluno integral, `cardNote` e `accessBusIdentifiers` precisam continuar disponíveis na geração
