# API Reference - Buses

Base: `/api/v1/bus`

## Conceitos

- `identifier`: identificador único do ônibus
- `shift`: turno principal do ônibus (`Manhã`, `Tarde`, `Noite`)
- `capacity`: capacidade máxima opcional
- `universitySlots`: faculdades vinculadas com prioridade e preenchimento

## `POST /bus`

Cria ônibus.

Body:

```json
{
  "identifier": "Onibus 02",
  "capacity": 40,
  "shift": "Manhã"
}
```

## `GET /bus`

Lista ônibus ativos.

## `GET /bus/inactive`

Lista ônibus inativos.

## `GET /bus/with-queue-counts`

Resumo de filas por ônibus e faculdade.

Nota: a resposta inclui `pendingCount` e `waitlistedCount` por ônibus e por `universitySlots`. Esse endpoint NÃO deve expor dados pessoais dos alunos (nomes, emails, CPF, telefone, etc.).

## `GET /bus/:id`

Busca ônibus por ID.

## `GET /bus/:id/queue-summary`

Resumo detalhado da fila do ônibus.

## `PATCH /bus/:id`

Atualiza ônibus.

## `PATCH /bus/:id/university-slots`

Atualiza faculdades e prioridades do ônibus.

## `PATCH /bus/:id/link-university`

Vincula faculdade ao ônibus.

## `PATCH /bus/:id/unlink-university`

Desvincula faculdade do ônibus.

## `PATCH /bus/:id/release-slots`

Libera vagas preenchidas do ônibus e, opcionalmente, promove waitlist.

Query params:
- `promote?: boolean` — default `true`. Se `false`, apenas zera/decrementa vagas sem promover.
- `quantity?: number` — opcional. Quando fornecido, libera/aplica promoção apenas para `quantity` vagas (não zera todas as vagas).

Retorna: `{ releasedSlots: number }`

## `DELETE /bus/:id`

Desativa ônibus.
