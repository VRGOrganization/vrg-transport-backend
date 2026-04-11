# VRG Transport API

![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js)
![NestJS](https://img.shields.io/badge/NestJS-11.x-E0234E?logo=nestjs)
![MongoDB](https://img.shields.io/badge/MongoDB-7.x-47A248?logo=mongodb)

Documentacao oficial do backend da plataforma VRG Transport.

## Visao Geral

API REST em NestJS para operacao de estudantes, funcionarios, imagens e carteirinhas, com:

- periodo de inscricao administravel
- fila de espera por periodo
- aprovacao concorrente com controle atomico de vagas
- expiracao de carteirinhas por validade de periodo

Base URL padrao:

- Desenvolvimento: http://localhost:3000/api/v1
- Swagger (somente com flag): http://localhost:3000/api/docs

## Modulos

| Modulo | Responsabilidade |
|---|---|
| Auth | Registro/login, OTP e sessao |
| Student | Perfil, horario, envio inicial e update de documentos |
| Employee | Gestao de funcionarios |
| LicenseRequest | Fluxo de solicitacoes initial/update |
| EnrollmentPeriod | Ciclo de inscricao, fila e liberacao de slots |
| License | Emissao, consulta, SSE e verificacao publica |
| Image | Documentos e foto de perfil |
| Admin | Gestao de admins |
| Mail | Emails transacionais |
| Common | Guards, filtros, pipes, auditoria e utilitarios |

## Indice de Documentos

| Documento | Conteudo |
|---|---|
| [getting-started.md](./getting-started.md) | Setup local, envs, scripts e seed |
| [architecture.md](./architecture.md) | Estrutura de modulos, dados e fluxos criticos |
| [authentication.md](./authentication.md) | Sessao, OTP, x-service-secret, login e logout |
| [roles-and-permissions.md](./roles-and-permissions.md) | Matriz de acesso por endpoint e role |
| [security.md](./security.md) | Camadas de seguranca e hardening ativo |
| [error-handling.md](./error-handling.md) | Padrao de erros e codigos HTTP |
| [contributing.md](./contributing.md) | Convencoes de contribuicao |
| [manual-testing-hoppscotch.md](./manual-testing-hoppscotch.md) | Roteiro manual ponta a ponta reformulado |

## Referencia de API

| Modulo | Documento |
|---|---|
| Auth | [api-reference/auth.md](./api-reference/auth.md) |
| Students | [api-reference/students.md](./api-reference/students.md) |
| Employees | [api-reference/employees.md](./api-reference/employees.md) |
| Enrollment Period | [api-reference/enrollment-periods.md](./api-reference/enrollment-periods.md) |
| License Requests | [api-reference/license-requests.md](./api-reference/license-requests.md) |
| Licenses | [api-reference/licenses.md](./api-reference/licenses.md) |
| Images | [api-reference/images.md](./api-reference/images.md) |
