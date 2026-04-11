# Roteiro Manual (Hoppscotch)

Fluxo ponta a ponta para validar periodo de inscricao, fila de espera e concorrencia de aprovacao.

Base URL padrao: http://localhost:3000/api/v1

## 1) Preparacao

Crie o environment VRG_LOCAL com:

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

Headers obrigatorios:

- rotas de auth: x-service-secret: {{SERVICE_SECRET}}
- rotas autenticadas: x-session-id: {{..._SESSION_ID}}

## 2) Sessao base (admin e employee)

### 2.1 Login admin

POST {{BASE_URL}}/auth/admin/login

{
  "username": "admin",
  "password": "Admin123"
}

Salvar sessionId em ADMIN_SESSION_ID.

### 2.2 Criar employee

POST {{BASE_URL}}/employee

{
  "name": "Employee Teste",
  "email": "employee.teste@vrg.local",
  "registrationId": "EMP900001",
  "password": "Senha123A"
}

### 2.3 Login employee

POST {{BASE_URL}}/auth/employee/login

{
  "registrationId": "EMP900001",
  "password": "Senha123A"
}

Salvar sessionId em EMPLOYEE_SESSION_ID.

## 3) Criar Periodo A (1 vaga)

POST {{BASE_URL}}/enrollment-period

{
  "startDate": "2026-04-01T00:00:00.000Z",
  "endDate": "2026-12-31T23:59:59.000Z",
  "totalSlots": 1,
  "licenseValidityMonths": 6
}

Salvar _id em PERIOD_A_ID.

## 4) Student A ocupa a vaga

### 4.1 Registrar e verificar student A

Executar:

- POST {{BASE_URL}}/auth/student/register

{
  "name": "Aluno A",
  "email": "aluno.a@teste.com",
  "password": "Aluno123A",
  "telephone": "+55 22 99999-1111",
  "cpf": "12345678909"
}

- POST {{BASE_URL}}/auth/student/verify

{
  "email": "aluno.a@teste.com",
  "code": "123456"
}

Salvar sessionId em STUDENT_A_SESSION_ID.

### 4.2 Submit inicial (multipart)

POST {{BASE_URL}}/student/me/license-submit

Campos esperados:

- institution
- degree
- shift
- bloodType
- schedule (json string)
- ProfilePhoto
- EnrollmentProof
- CourseSchedule

Exemplo de body (form-data):

- institution: Instituto Federal Fluminense
- degree: Sistemas de Informacao
- shift: MORNING
- bloodType: O+
- schedule: [{"day":"SEG","period":"Manhã"},{"day":"QUA","period":"Noite"}]
- ProfilePhoto: (arquivo)
- EnrollmentProof: (arquivo)
- CourseSchedule: (arquivo)

### 4.3 Verificar solicitacao de A

GET {{BASE_URL}}/license-request/me

Esperado: status pending.
Salvar id em REQUEST_A_ID.

### 4.4 Aprovar A

PATCH {{BASE_URL}}/license-request/approve/{{REQUEST_A_ID}}

{
  "bus": "A01",
  "institution": "IF Teste"
}

Esperado: approved e licenca ativa.

## 5) Student B entra na fila

### 5.1 Registrar e verificar student B

Executar:

- POST {{BASE_URL}}/auth/student/register

{
  "name": "Aluno B",
  "email": "aluno.b@teste.com",
  "password": "Aluno123B",
  "telephone": "+55 22 99999-2222",
  "cpf": "98765432100"
}

- POST {{BASE_URL}}/auth/student/verify

{
  "email": "aluno.b@teste.com",
  "code": "123456"
}

Salvar sessionId em STUDENT_B_SESSION_ID.

### 5.2 Submit inicial B

POST {{BASE_URL}}/student/me/license-submit (multipart)

Exemplo de body (form-data):

- institution: Universidade Federal Fluminense
- degree: Engenharia de Producao
- shift: AFTERNOON
- bloodType: A+
- schedule: [{"day":"TER","period":"Tarde"},{"day":"QUI","period":"Noite"}]
- ProfilePhoto: (arquivo)
- EnrollmentProof: (arquivo)
- CourseSchedule: (arquivo)

### 5.3 Validar waitlist

GET {{BASE_URL}}/license-request/me

Esperado:

- status waitlisted
- filaPosition = 1

Salvar id em REQUEST_B_ID.

## 6) Promocao de fila

### 6.1 Preview

POST {{BASE_URL}}/enrollment-period/{{PERIOD_A_ID}}/release-slots

{
  "quantity": 1
}

### 6.2 Confirmar promocao

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

Esperado: approved e licenca criada.

## 7) Alterar validade do periodo

PATCH {{BASE_URL}}/enrollment-period/{{PERIOD_A_ID}}

{
  "licenseValidityMonths": 7
}

Esperado:

- periodo atualizado
- expiracao das licencas ativas ajustada por delta

## 8) Encerrar ciclo e abrir novo periodo

### 8.1 Encerrar Periodo A

PATCH {{BASE_URL}}/enrollment-period/{{PERIOD_A_ID}}/close

Esperado:

- active = false
- fila waitlisted encerrada
- closedWaitlistCount preenchido quando houver fila

### 8.2 Criar Periodo B

POST {{BASE_URL}}/enrollment-period

{
  "startDate": "2027-01-01T00:00:00.000Z",
  "endDate": "2027-06-30T23:59:59.000Z",
  "totalSlots": 100,
  "licenseValidityMonths": 6
}

Salvar _id em PERIOD_B_ID.

## 9) Sanidade e regressao

### 9.1 Confirm-release com IDs duplicados

POST /enrollment-period/:id/confirm-release com requestIds duplicados.

Body:

{
  "requestIds": ["{{REQUEST_B_ID}}", "{{REQUEST_B_ID}}"]
}

Esperado: 400.

### 9.2 Aprovacao concorrente sem vaga

Disparar duas aprovacoes em paralelo para requests diferentes em periodo lotado.

Esperado:

- conflito 409 na disputa
- nenhuma licenca extra criada

### 9.3 Update de documentos fora do periodo

POST /student/me/document-update-request para aluno ja aprovado.

Exemplo de body (form-data):

- changedDocuments: ["ProfilePhoto","EnrollmentProof"]
- ProfilePhoto: (arquivo)
- EnrollmentProof: (arquivo)

Esperado: fluxo permitido.

## 10) Fechamento

Checklist final:

- GET /license-request/me coerente para os alunos
- GET /enrollment-period/:id/waitlist coerente para o periodo vigente
- GET /license/all coerente para operacao
- GET /student/stats/dashboard coerente para resumo
