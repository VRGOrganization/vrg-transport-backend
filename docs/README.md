# VRG Transport API

![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js)
![NestJS](https://img.shields.io/badge/NestJS-11.x-E0234E?logo=nestjs)
![MongoDB](https://img.shields.io/badge/MongoDB-7.x-47A248?logo=mongodb)

API REST para o sistema de gestão de transporte escolar municipal. Gerencia o cadastro de estudantes, funcionários e a emissão de carteirinhas digitais com foto.

---

## Módulos

| Módulo | Responsabilidade | Roles com acesso |
|---|---|---|
| **Auth** | Autenticação (JWT), registro com OTP, refresh token | Público (com rate limit) |
| **Student** | CRUD de estudantes | STUDENT (próprio perfil), EMPLOYEE, ADMIN |
| **Employee** | CRUD de funcionários | ADMIN |
| **License** | Emissão e gestão de carteirinhas | EMPLOYEE, ADMIN |
| **Image** | Gestão de fotos dos estudantes | STUDENT (próprias), EMPLOYEE, ADMIN |
| **Admin** | Schema e seeding de administradores | — |
| **Common** | Guards, pipes, filtros, enums, audit log | — |
| **Mail** | Envio de e-mail (OTP) | — |

---

## Quick Start

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com suas configurações

# 3. Subir a API em modo de desenvolvimento
npm run start:dev
```

A API estará disponível em `http://localhost:3000/api/v1`.  
Swagger (somente em `NODE_ENV=development` com `ENABLE_SWAGGER=true`): `http://localhost:3000/api/docs`

---

## Documentação

| Documento | Conteúdo |
|---|---|
| [Getting Started](./getting-started.md) | Pré-requisitos, variáveis de ambiente, instalação, seed de admin |
| [Arquitetura](./architecture.md) | Estrutura de módulos, padrão Repository, fluxo de requisição |
| [Autenticação](./authentication.md) | Registro OTP, login, tokens JWT, rate limiting |
| [Roles e Permissões](./roles-and-permissions.md) | Tabela completa endpoint × role |
| [Segurança](./security.md) | Camadas de segurança, CORS, recomendações para produção |
| [Tratamento de Erros](./error-handling.md) | Estrutura de erros, códigos HTTP, exemplos |
| [Contribuindo](./contributing.md) | Padrões de código, convenções de commit, checklist de PR |

### Referência de Endpoints

| Módulo | Documento |
|---|---|
| Auth | [api-reference/auth.md](./api-reference/auth.md) |
| Students | [api-reference/students.md](./api-reference/students.md) |
| Employees | [api-reference/employees.md](./api-reference/employees.md) |
| Licenses | [api-reference/licenses.md](./api-reference/licenses.md) |
| Images | [api-reference/images.md](./api-reference/images.md) |

---

## Stack

- **Runtime:** Node.js 22
- **Framework:** NestJS 11
- **Banco de dados:** MongoDB (Mongoose 9) — duas conexões separadas (principal + imagens)
- **Autenticação:** JWT (access + refresh token rotativo)
- **Validação:** class-validator + class-transformer
- **Documentação:** Swagger / OpenAPI 3
- **E-mail:** Nodemailer
