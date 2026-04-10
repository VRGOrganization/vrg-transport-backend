# Arquitetura

## Estrutura de alto nível

```text
src/
  main.ts
  app.module.ts
  auth/
  student/
  employee/
  admin/
  image/
  license/
  license-request/
  mail/
  common/
```

## Módulos e dependências principais

- `AppModule`
  - Config global (`ConfigModule`)
  - Conexão Mongo principal (`MONGODB_URI`)
  - Conexão Mongo de imagens (`MONGODB_URI_IMAGE`, connectionName `images`)
  - Registro de módulos de domínio
  - Registro de guards globais

- `AuthModule`
  - Registro e login por perfil
  - Verificação OTP
  - Sessões server-side
  - Proteção com `ServiceSecretGuard` nas rotas de auth

- `StudentModule`
  - Perfil e atualização de dados
  - Grade horária
  - Envio de solicitação inicial de carteirinha
  - Pedido de alteração de documentos
  - Estatísticas de dashboard

- `LicenseRequestModule`
  - Aprovação/reprovação por funcionário/admin
  - Fluxo de `initial` e `update`

- `LicenseModule`
  - Emissão de carteirinha via serviço externo
  - Verificação pública por código
  - SSE por estudante com ticket efêmero

- `ImagesModule`
  - Armazenamento de foto/documentos em base64/PDF
  - Histórico de versão de imagens de estudante

## Conexões de banco

| Conexão | Variável | Uso |
|---|---|---|
| Principal | `MONGODB_URI` | estudantes, funcionários, admins, licenças, solicitações |
| Imagens (`images`) | `MONGODB_URI_IMAGE` | imagens e histórico de imagens |

## Pipeline de requisição

### Global (AppModule)

1. `SessionAuthGuard`
2. `RateLimitGuard`
3. `RolesGuard`

### No módulo Auth (AuthController)

Além dos guards globais, o controller aplica:

- `ServiceSecretGuard`
- `RateLimitGuard` com limites por endpoint via decorator `@RateLimit(...)`

## Segurança no bootstrap (`main.ts`)

- Body parser manual com limite de 2MB (`json` e `urlencoded`)
- `cookie-parser`
- `helmet` com CSP e HSTS
- header `Permissions-Policy`
- CORS restrito por `ALLOWED_ORIGINS`
- prefixo global `/api/v1`
- `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`)
- `HttpExceptionFilter` global

## Fluxo funcional resumido (licença)

1. Estudante envia dados e arquivos em `POST /student/me/license-submit`
2. Sistema cria solicitação pendente em `license-request`
3. Funcionário/admin aprova (`PATCH /license-request/approve/:id`) ou rejeita
4. Em aprovação, backend chama API externa para gerar carteirinha
5. Aluno acompanha status por SSE (`/license/events` com ticket)
