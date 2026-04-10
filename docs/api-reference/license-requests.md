# API Reference — License Requests

Base: `/api/v1/license-request`

## Conceitos

- `type`:
  - `initial`: primeira solicitação
  - `update`: alteração de documentos após aprovação inicial
- `status`:
  - `pending`
  - `approved`
  - `rejected`
  - `cancelled`

## GET /license-request/all

Lista todas as solicitações.

Roles: `EMPLOYEE`, `ADMIN`

## GET /license-request/pending

Lista solicitações pendentes.

Roles: `EMPLOYEE`, `ADMIN`

## GET /license-request/me

Retorna solicitação mais recente do estudante autenticado.

Roles: `STUDENT`

## GET /license-request/student/:studentId

Lista solicitações de um estudante.

Roles: `EMPLOYEE`, `ADMIN`

## PATCH /license-request/approve/:id

Aprova solicitação.

Roles: `EMPLOYEE`, `ADMIN`

Body:

```json
{
  "bus": "205",
  "institution": "Universidade Federal Fluminense",
  "photo": "data:image/jpeg;base64,..."
}
```

Comportamento:

- Para `initial`: cria licença
- Para `update`: regenera licença existente, arquiva versões antigas de imagem e aplica pendências

## PATCH /license-request/reject/:id

Rejeita solicitação.

Roles: `EMPLOYEE`, `ADMIN`

Body:

```json
{
  "reason": "Documentos ilegíveis ou corrompidos"
}
```

Motivos aceitos:

- Foto inadequada ou ilegível
- Comprovante de matrícula inválido
- Grade horária não corresponde aos documentos
- Documentos ilegíveis ou corrompidos
- Informações inconsistentes
