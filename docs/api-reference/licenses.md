# API Reference — Licenses

Base: `/api/v1/license`

## POST /license/events/token

Emite ticket efêmero para conexão SSE.

Roles: `STUDENT`

Resposta:

```json
{
  "ticket": "uuid",
  "expiresInMs": 60000
}
```

## GET /license/events?ticket=...

Canal SSE público protegido por ticket de uso único.

Eventos enviados:

- `connected`
- `heartbeat`
- `license.changed` (`created`, `updated`, `removed`, `rejected`)

## GET /license/verify/:code

Rota pública para verificar autenticidade da carteirinha.

Resposta:

```json
{
  "exists": true,
  "valid": true,
  "status": "active"
}
```

Se código inválido/inexistente:

```json
{
  "exists": false
}
```

## POST /license/create

Emite carteirinha para estudante.

Roles: `ADMIN`

Pré-condição: estudante precisa ter ao menos uma solicitação `APPROVED` em `license-request`.

Body:

```json
{
  "id": "studentObjectId",
  "institution": "Universidade Federal Fluminense",
  "bus": "205",
  "photo": "data:image/jpeg;base64,..."
}
```

Respostas: `201`, `400`, `404`, `502`, `504`

## GET /license/health

Healthcheck do serviço externo de licença.

Roles: `EMPLOYEE`, `ADMIN`

## GET /license/all

Lista todas as licenças.

Roles: `EMPLOYEE`, `ADMIN`

## GET /license/searchByStudent/:studentId

Busca licença por estudante.

Roles: `EMPLOYEE`, `ADMIN`

## GET /license/me

Busca licença do estudante autenticado.

Roles: `STUDENT`

## GET /license/:id

Busca licença por ID.

Roles: `EMPLOYEE`, `ADMIN`

## PATCH /license/update/:id

Atualiza licença (gera nova licença e remove a anterior).

Roles: `EMPLOYEE`, `ADMIN`

Body: mesmo formato de `POST /license/create`.

## PATCH /license/reject/:id

Marca licença como rejeitada e envia e-mail.

Roles: `EMPLOYEE`, `ADMIN`

Body:

```json
{
  "reason": "Foto inadequada ou ilegível"
}
```

Motivos aceitos:

- Foto inadequada ou ilegível
- Comprovante de matrícula inválido
- Grade horária não corresponde aos documentos
- Documentos ilegíveis ou corrompidos
- Informações inconsistentes

## DELETE /license/delete/:id

Remove licença.

Roles: `ADMIN`
