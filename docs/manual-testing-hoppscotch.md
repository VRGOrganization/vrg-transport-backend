# Roteiro Manual (Hoppscotch)

Roteiro reformulado para validar o fluxo atual:

1. periodo e vaga
2. fila de espera
3. promocao de fila
4. ajuste de validade do periodo
5. encerramento de ciclo e abertura de novo periodo

Base URL: http://localhost:3000/api/v1

## 1) Preparacao

Crie Environment VRG_LOCAL com:

- BASE_URL
- SERVICE_SECRET
- ADMIN_SESSION_ID
- EMPLOYEE_SESSION_ID
- STUDENT_A_SESSION_ID
- STUDENT_B_SESSION_ID
- PERIOD_A_ID
- PERIOD_B_ID
- REQUEST_A_ID
- REQUEST_B_ID

Regras de header:

- rotas auth: x-service-secret
- rotas autenticadas: x-session-id

## 2) Sessao base de admin e employee

### 2.1 Login admin

POST {{BASE_URL}}/auth/admin/login

Body:

{
  "username": "admin",
  "password": "Admin123"
}

Guarde sessionId em ADMIN_SESSION_ID.

### 2.2 Criar e logar employee

POST {{BASE_URL}}/employee

{
  "name": "Employee Teste",
  "email": "employee.teste@vrg.local",
  "registrationId": "EMP900001",
  "password": "Senha123A"
}

POST {{BASE_URL}}/auth/employee/login

{
  "registrationId": "EMP900001",
  "password": "Senha123A"
}

Guarde sessionId em EMPLOYEE_SESSION_ID.

## 3) Criar Periodo A (1 vaga, validade 6)

POST {{BASE_URL}}/enrollment-period

{
  "dataInicio": "2026-04-01T00:00:00.000Z",
  "dataFim": "2026-12-31T23:59:59.000Z",
  "qtdVagasTotais": 1,
  "validadeCarteirinhaMeses": 6
}

Guarde _id em PERIOD_A_ID.

## 4) Student A ocupa a vaga

### 4.1 Registrar/verificar student A

POST /auth/student/register e POST /auth/student/verify.

Guarde sessao em STUDENT_A_SESSION_ID.

### 4.2 Submit inicial A

POST {{BASE_URL}}/student/me/license-submit (multipart)

Campos:

- institution
- degree
- shift
- bloodType
- schedule (json string)
- ProfilePhoto
- EnrollmentProof
- CourseSchedule

### 4.3 Validar request A

GET {{BASE_URL}}/license-request/me

Esperado: status pending.
Guarde id em REQUEST_A_ID.

### 4.4 Aprovar A

PATCH {{BASE_URL}}/license-request/approve/{{REQUEST_A_ID}}

{
  "bus": "A01",
  "institution": "IF Teste"
}

Esperado: approved + licenca ativa.

## 5) Student B entra na fila

### 5.1 Registrar/verificar student B

POST /auth/student/register e POST /auth/student/verify.

Guarde sessao em STUDENT_B_SESSION_ID.

### 5.2 Submit inicial B

POST {{BASE_URL}}/student/me/license-submit (multipart)

### 5.3 Validar fila

GET {{BASE_URL}}/license-request/me

Esperado:

- status waitlisted
- filaPosition 1

Guarde id em REQUEST_B_ID.

## 6) Promocao de fila

### 6.1 Preview

POST {{BASE_URL}}/enrollment-period/{{PERIOD_A_ID}}/release-slots

{
  "quantidade": 1
}

### 6.2 Confirm-release

POST {{BASE_URL}}/enrollment-period/{{PERIOD_A_ID}}/confirm-release

{
  "requestIds": ["{{REQUEST_B_ID}}"]
}

### 6.3 Aprovar B

PATCH {{BASE_URL}}/license-request/approve/{{REQUEST_B_ID}}

{
  "bus": "A01",
  "institution": "IF Teste"
}

Esperado: approved + licenca criada.

## 7) Alterar validade do periodo (6 -> 7)

PATCH {{BASE_URL}}/enrollment-period/{{PERIOD_A_ID}}

{
  "validadeCarteirinhaMeses": 7
}

Esperado:

- periodo atualizado
- expiracao das licencas ativas do periodo ajustada por delta

## 8) Encerrar ciclo e abrir novo periodo

### 8.1 Encerrar Periodo A

PATCH {{BASE_URL}}/enrollment-period/{{PERIOD_A_ID}}/close

Esperado:

- ativo false
- fila waitlisted do periodo encerrada
- qtdFilaEncerrada preenchida quando houver fila

### 8.2 Criar Periodo B

POST {{BASE_URL}}/enrollment-period

{
  "dataInicio": "2027-01-01T00:00:00.000Z",
  "dataFim": "2027-06-30T23:59:59.000Z",
  "qtdVagasTotais": 100,
  "validadeCarteirinhaMeses": 6
}

Guarde _id em PERIOD_B_ID.

## 9) Sanidade e regressao

### 9.1 Confirm-release com IDs duplicados

POST /enrollment-period/:id/confirm-release com requestIds duplicados.

Esperado: 400.

### 9.2 Aprovacao concorrente sem vaga

Dispare duas aprovacoes ao mesmo tempo para requests diferentes de um periodo lotado.

Esperado:

- conflito 409 na disputa
- sem criacao extra de licenca

### 9.3 Update de documentos fora do periodo

POST /student/me/document-update-request para aluno ja aprovado.

Esperado: fluxo permitido.

## 10) Fechamento

Checklist final:

- GET /license-request/me coerente para os alunos
- GET /enrollment-period/:id/waitlist coerente para periodo vigente
- GET /license/all coerente para operacao
- GET /student/stats/dashboard coerente para resumo
