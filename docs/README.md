# VRG Transport Backend

Backend NestJS da plataforma VRG Transport.

Esta documentação foi reorganizada para refletir o estado atual do backend e servir de contrato para front-end, API e automações.

## O que o backend faz hoje

- autenticação por sessão server-side com OTP para estudante
- controle de papéis para estudante, funcionário e admin
- períodos de inscrição com fila, waitlist e promoção concorrente
- criação centralizada de solicitações de carteirinha
- emissão e atualização de carteirinhas via serviço externo
- associação de faculdade, ônibus e turno do estudante
- anotação de carteirinha para alunos integrais
- auditoria dos eventos críticos

## Regras de integração que front e API precisam respeitar

- `Shift` do estudante usa `Manhã`, `Tarde`, `Noite` e `Integral`.
- o ônibus também possui `shift` principal.
- a inscrição inicial é direcionada pelo backend com base em faculdade + turno.
- aluno `Integral` é encaminhado para o ônibus da `Manhã` quando houver correspondência.
- a `LicenseRequest` guarda `cardNote` e `accessBusIdentifiers` para a geração da carteirinha.
- o front não deve escolher manualmente o ônibus na inscrição inicial.
- `PATCH /license/update/:id` usa `id` na rota e corpo parcial.

## Mapa da documentação

- [getting-started.md](./getting-started.md)
- [architecture.md](./architecture.md)
- [authentication.md](./authentication.md)
- [security.md](./security.md)
- [error-handling.md](./error-handling.md)
- [roles-and-permissions.md](./roles-and-permissions.md)
- [integration-contract.md](./integration-contract.md)
- [manual-testing-hoppscotch.md](./manual-testing-hoppscotch.md)
- [contributing.md](./contributing.md)
 - [invariants.md](./invariants.md)

## Referências de API

- [api-reference/auth.md](./api-reference/auth.md)
- [api-reference/students.md](./api-reference/students.md)
- [api-reference/employees.md](./api-reference/employees.md)
- [api-reference/universities.md](./api-reference/universities.md)
- [api-reference/courses.md](./api-reference/courses.md)
- [api-reference/buses.md](./api-reference/buses.md)
- [api-reference/enrollment-periods.md](./api-reference/enrollment-periods.md)
- [api-reference/license-requests.md](./api-reference/license-requests.md)
- [api-reference/licenses.md](./api-reference/licenses.md)
- [api-reference/images.md](./api-reference/images.md)
