# VRG Transport API

![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js)
![NestJS](https://img.shields.io/badge/NestJS-11.x-E0234E?logo=nestjs)
![MongoDB](https://img.shields.io/badge/MongoDB-7.x-47A248?logo=mongodb)

Documentação oficial do backend da plataforma VRG Transport.

## Visão Geral

API REST em NestJS para gestão de estudantes, funcionários, imagens, solicitações de carteirinha e emissão de carteirinhas.

Base URL padrão:

- Desenvolvimento: `http://localhost:3000/api/v1`
- Swagger (somente dev + flag): `http://localhost:3000/api/docs`

## Módulos

| Módulo | Responsabilidade |
|---|---|
| Auth | Registro/login, verificação OTP, sessão |
| Student | Perfil do estudante, grade de horários, envio de solicitação |
| Employee | Gestão de funcionários |
| LicenseRequest | Fluxo de aprovação/reprovação de solicitação |
| License | Emissão, consulta, rejeição e eventos SSE da carteirinha |
| Image | Fotos e documentos de estudante |
| Admin | Cadastro de administradores |
| Mail | Envio de e-mails transacionais (Brevo) |
| Common | Filtros, pipes, auditoria e utilitários transversais |

## Índice de Documentos

| Documento | Conteúdo |
|---|---|
| [getting-started.md](./getting-started.md) | Instalação, variáveis de ambiente, execução e seed |
| [architecture.md](./architecture.md) | Estrutura de módulos, conexões, fluxo de requisição |
| [authentication.md](./authentication.md) | Sessão, OTP, x-service-secret, login e logout |
| [roles-and-permissions.md](./roles-and-permissions.md) | Matriz de acesso por endpoint e role |
| [security.md](./security.md) | Camadas de segurança e hardening |
| [error-handling.md](./error-handling.md) | Formato de erros e códigos HTTP |
| [contributing.md](./contributing.md) | Padrões de contribuição e checklist |

## Referência de API

| Módulo | Documento |
|---|---|
| Auth | [api-reference/auth.md](./api-reference/auth.md) |
| Students | [api-reference/students.md](./api-reference/students.md) |
| Employees | [api-reference/employees.md](./api-reference/employees.md) |
| Licenses | [api-reference/licenses.md](./api-reference/licenses.md) |
| License Requests | [api-reference/license-requests.md](./api-reference/license-requests.md) |
| Images | [api-reference/images.md](./api-reference/images.md) |
