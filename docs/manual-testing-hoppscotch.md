# Teste Manual com Hoppscotch

Roteiro ponta a ponta para validar o fluxo atual de inscrição e carteirinha.

Base URL:

- `http://localhost:3000/api/v1`

## 1. Preparar environment

Crie um environment com:

- `BASE_URL`
- `SERVICE_SECRET`
- `ADMIN_SESSION_ID`
- `EMPLOYEE_SESSION_ID`
- `STUDENT_MORNING_SESSION_ID`
- `STUDENT_INTEGRAL_SESSION_ID`
- `UNIVERSITY_ID`
- `BUS_MORNING_ID`
- `BUS_NIGHT_ID`
- `PERIOD_ID`
- `REQUEST_ID`

Headers:

- auth: `x-service-secret: {{SERVICE_SECRET}}`
- rotas autenticadas: `x-session-id: {{..._SESSION_ID}}`

## 2. Criar dados base

### 2.1 Faculdade

`POST {{BASE_URL}}/university`

```json
{
  "name": "Instituto Federal do Exemplo",
  "acronym": "IFE"
}
```

### 2.2 Ônibus da manhã

`POST {{BASE_URL}}/bus`

```json
{
  "identifier": "Onibus 02",
  "capacity": 40,
  "shift": "Manhã"
}
```

### 2.3 Ônibus da noite

`POST {{BASE_URL}}/bus`

```json
{
  "identifier": "Onibus 06",
  "capacity": 40,
  "shift": "Noite"
}
```

### 2.4 Vincular faculdade aos ônibus

`PATCH {{BASE_URL}}/bus/{{BUS_MORNING_ID}}/link-university`

```json
{ "universityId": "{{UNIVERSITY_ID}}" }
```

Repita para `BUS_NIGHT_ID`.

### 2.5 Criar período

`POST {{BASE_URL}}/enrollment-period`

```json
{
  "startDate": "2026-04-01T00:00:00.000Z",
  "endDate": "2026-12-31T23:59:59.000Z",
  "totalSlots": 1,
  "licenseValidityMonths": 6
}
```

## 3. Estudante normal

1. registrar e verificar o estudante
2. enviar `POST /student/me/license-submit`
3. conferir `GET /license-request/me`
4. aprovar a request

Esperado:

- ônibus selecionado conforme turno
- request com `busId` e `universityId`

## 4. Estudante integral

Use outro estudante com `shift = Integral`.

No `POST /student/me/license-submit`, envie:

```json
{
  "institution": "Instituto Federal do Exemplo",
  "degree": "Engenharia",
  "shift": "Integral",
  "bloodType": "A+",
  "schedule": "[{\"day\":\"SEG\",\"period\":\"Manhã\"}]"
}
```

Esperado ao consultar `GET /license-request/me`:

- request apontando para o ônibus da manhã
- `cardNote` indicando que o aluno é integral
- `accessBusIdentifiers` com os ônibus da faculdade

## 5. Aprovação e carteirinha

`PATCH {{BASE_URL}}/license-request/approve/{{REQUEST_ID}}`

```json
{
  "bus": "Onibus 02",
  "institution": "Instituto Federal do Exemplo",
  "photo": "data:image/png;base64,..."
}
```

Depois valide:

- `GET /license/verify/:code`
- `GET /license/me` no aluno
