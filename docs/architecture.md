# Arquitetura

## Visão geral

A API é modular e segue um padrão simples:

- controller fino
- regra no service
- persistência por repositório
- DTO com validação
- sessão server-side
- auditoria para ações críticas

## Módulos principais

- `AuthModule` - registro, OTP, login, logout e reset de senha
- `StudentModule` - perfil, grade, foto e envio de solicitação
- `LicenseRequestModule` - fluxo de inscrição, aprovação e rejeição
- `LicenseModule` - emissão, SSE, consulta e verificação da carteirinha
- `EnrollmentPeriodModule` - períodos, fila e promoção
- `BusModule` - ônibus, vínculo de faculdade, prioridade e `shift`
- `UniversityModule` - faculdades
- `CourseModule` - cursos
- `EmployeeModule` - funcionários
- `ImageModule` - documentos e foto
- `Common` - guards, filtros, pipes, auditoria e utilitários

## Modelo de dados que importa para o front

### Student

- `shift`: `Manhã`, `Tarde`, `Noite`, `Integral`
- `universityId`: faculdade vinculada
- `secondaryBusId`: apoio para consultas

### Bus

- `identifier`
- `shift`
- `capacity`
- `universitySlots`

### LicenseRequest

- `type`: `initial` ou `update`
- `status`: `pending`, `approved`, `rejected`, `cancelled`, `waitlisted`
- `busId` e `universityId`
- `cardNote`
- `accessBusIdentifiers`
- `filaPosition`

### License

- `status`: `active`, `inactive`, `expired`, `rejected`
- `verificationCode`
- `enrollmentPeriodId`

## Fluxos importantes

### Inscrição inicial

1. O estudante envia multipart em `POST /student/me/license-submit`.
2. O backend atualiza perfil e imagens.
3. A request é direcionada por faculdade + turno.
4. Aluno `Integral` vai para o ônibus da `Manhã` quando possível.
5. A request recebe nota e snapshot para a carteirinha.

### Aprovação

1. O funcionário aprova a request.
2. O backend atualiza a vaga do período e do ônibus quando necessário.
3. A carteirinha é gerada pelo serviço externo.
4. A emissão usa o contexto gravado na request.

### Waitlist

1. Sem capacidade, a request entra em `waitlisted`.
2. A posição é calculada por ônibus.
3. A fila é reindexada quando vagas são liberadas.

## Integração entre front e API

- o front não deve inferir a regra de ônibus
- o front pode exibir `bus.shift` e `cardNote`
- `cardNote` e `accessBusIdentifiers` são a ponte entre inscrição e carteirinha
- `inactive` possui rota própria para não colidir com `:id`

## Regra de prioridade dinâmica

A backend aplica uma regra de prioridade por universidade dentro de cada ônibus: enquanto uma universidade de maior prioridade tiver qualquer demanda ativa (status `pending` ou `waitlisted`) apenas alunos dessa universidade devem aparecer como aprováveis ou serem promovidos a partir da fila.

- Face 1 — Inscrição: o backend resolve o ônibus e decide `pending` vs `waitlisted` considerando demanda ativa das faculdades de maior prioridade (implementado em `LicenseRequestService.createRequest`).
- Face 2 — Aprovação / Liberação de vagas: as listas apresentadas ao funcionário e as promoções pela API respeitam a prioridade dinâmica; o endpoint `PATCH /bus/:id/release-slots` suporta os parâmetros de query `promote?: boolean` (default `true`) e `quantity?: number` para liberar somente N vagas quando necessário.

Para uma lista completa de invariantes que o backend garante e que o front deve respeitar, veja [invariants.md](./invariants.md).
