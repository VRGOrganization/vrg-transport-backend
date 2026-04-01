# Arquitetura

## Estrutura de Módulos

```
vrg-transport-backend/
├── src/
│   ├── main.ts                     # Bootstrap: Helmet, CORS, Swagger, ValidationPipe, prefixo /api/v1
│   ├── app.module.ts               # Módulo raiz: guards globais, conexões MongoDB
│   │
│   ├── auth/                       # Autenticação JWT, OTP, refresh token
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.module.ts
│   │   ├── dto/
│   │   ├── guards/                 # JwtAuthGuard, RolesGuard
│   │   └── strategies/             # JwtStrategy (passport-jwt)
│   │
│   ├── student/                    # CRUD de estudantes
│   │   ├── student.controller.ts
│   │   ├── student.service.ts
│   │   ├── student.module.ts
│   │   ├── schemas/student.schema.ts
│   │   ├── repositories/
│   │   └── dto/
│   │
│   ├── employee/                   # CRUD de funcionários (ADMIN only)
│   │   ├── employee.controller.ts
│   │   ├── employee.service.ts
│   │   └── ...
│   │
│   ├── admin/                      # Schema e service de admins
│   │   ├── admin.service.ts
│   │   ├── admin.module.ts
│   │   └── schemas/admin.schema.ts
│   │
│   ├── license/                    # Emissão de carteirinhas (serviço externo)
│   │   ├── license.controller.ts
│   │   ├── license.service.ts
│   │   └── dto/create-license.dto.ts
│   │
│   ├── image/                      # Fotos dos estudantes (conexão MongoDB separada)
│   │   ├── image.controller.ts
│   │   ├── image.service.ts
│   │   ├── schemas/
│   │   ├── dto/
│   │   └── types/photoType.enum.ts
│   │
│   ├── mail/                       # Envio de e-mail OTP (Nodemailer)
│   │   └── mail.service.ts
│   │
│   └── common/                     # Utilitários transversais
│       ├── config/
│       │   └── security.validation.ts   # Validação de variáveis de ambiente
│       ├── decorators/
│       │   ├── roles.decorator.ts       # @Roles(UserRole.ADMIN)
│       │   ├── public.decorator.ts      # @Public()
│       │   └── current-user.decorator.ts # @CurrentUser()
│       ├── enums/
│       │   ├── user-role.enum.ts        # ADMIN, EMPLOYEE, STUDENT
│       │   ├── blood-type.enum.ts       # A+, A-, B+, B-, AB+, AB-, O+, O-
│       │   └── shift.enum.ts            # Matutino, Vespertino, Noturno, Integral
│       ├── filters/
│       │   └── http-exception.filter.ts # Resposta de erro padronizada
│       ├── guards/
│       │   ├── jwt-auth.guard.ts
│       │   ├── roles.guard.ts
│       │   └── rate-limit.guard.ts
│       ├── pipes/
│       │   └── mongo-object-id.pipe.ts  # Valida ObjectId do MongoDB
│       └── audit/
│           └── audit-log.service.ts     # Log de eventos sensíveis
│
├── scripts/
│   └── seed-admin.ts               # Cria o primeiro admin
└── .env.example
```

---

## Dependências entre Módulos

```
AppModule
  ├── AuthModule ──────────────────── usa StudentModule, EmployeeModule, AdminModule, MailModule
  ├── StudentModule ───────────────── independente
  ├── EmployeeModule ──────────────── independente
  ├── AdminModule ─────────────────── independente
  ├── LicenseModule ───────────────── independente (chama serviço externo via HTTP)
  ├── ImagesModule ────────────────── usa conexão 'images' (MongoDB separado)
  ├── MailModule ──────────────────── independente
  └── CommonModule ────────────────── transversal (guards, pipes, filtros, enums)
```

---

## Conexões com o Banco de Dados

A aplicação mantém **duas conexões MongoDB distintas**:

| Conexão | Variável | Dados armazenados |
|---|---|---|
| Principal (padrão) | `MONGODB_URI` | Estudantes, funcionários, admins, licenças, audit log |
| Imagens (`images`) | `MONGODB_URI_IMAGE` | Fotos dos estudantes (base64) |

A separação evita que documentos grandes de imagem degradem a performance das consultas principais.

---

## Padrão Repository

Módulos como `Student` e `Employee` utilizam o padrão Repository para desacoplar a camada de acesso a dados:

```
Controller
    │ chama
    ▼
Service (regras de negócio)
    │ chama interface
    ▼
IStudentRepository (contrato)
    │ implementado por
    ▼
StudentRepository (Mongoose)
```

**Estrutura de arquivos:**

```
student/
├── repositories/
│   ├── student.repository.interface.ts   # contrato (interface)
│   └── student.repository.ts             # implementação com Mongoose
```

O `StudentService` depende da interface, não da implementação. Isso permite trocar a implementação sem alterar o service.

> **Atenção:** O `AdminService` ainda usa consultas Mongoose diretas (sem o padrão Repository). Isso é inconsistente com os demais módulos e deve ser corrigido em refatoração futura.

---

## Fluxo de uma Requisição Autenticada

```
Cliente
  │
  │ HTTPS + Bearer Token
  ▼
Express (main.ts)
  ├── Helmet (headers de segurança)
  ├── CORS (origem verificada contra ALLOWED_ORIGINS)
  └── Body parser (limite 2MB, antes de qualquer parse)
  │
  ▼
NestJS Pipeline
  ├── 1. RateLimitGuard (global) ── verifica IP + keyPrefix do endpoint
  ├── 2. JwtAuthGuard (global) ──── verifica Bearer token (pula rotas @Public())
  ├── 3. RolesGuard (global) ─────── verifica @Roles() no handler
  ├── 4. MongoObjectIdPipe ─────────── valida parâmetros :id (aplicado por endpoint)
  ├── 5. ValidationPipe (global) ──── valida e transforma o body (whitelist, forbidNonWhitelisted)
  │
  ▼
Controller
  └── chama Service
        └── chama Repository / Serviço externo
              └── retorna dado ou lança exceção
  │
  ▼
HttpExceptionFilter (global)
  └── formata resposta de erro padronizada
  │
  ▼
Cliente recebe resposta
```

---

## Decisões Arquiteturais

### Por que MongoDB?
O modelo de dados tem estrutura variável por perfil (estudante, funcionário, admin possuem campos distintos). O MongoDB permite schemas flexíveis sem migrações complexas.

### Por que dois databases separados?
Documentos de imagem em base64 podem ter até 2MB cada. Mantê-los em uma coleção separada evita que queries nas coleções principais carreguem esses dados desnecessariamente.

### Por que módulos isolados?
Cada domínio (Student, Employee, License, Image) é autônomo. Adicionar ou remover um módulo não afeta os demais. Os guards e pipes transversais vivem em `CommonModule` e são aplicados globalmente em `AppModule`.

### Por que audit log?
Eventos sensíveis (login, logout, registro, verificação de e-mail, emissão de carteirinha) são registrados com dados redatados (hash de e-mail, telefone, código OTP). Permite rastrear atividade suspeita sem expor dados pessoais nos logs.

### Por que refresh token com versionamento?
O campo `refreshTokenVersion` no schema e no payload JWT permite detectar reuso de tokens. Se um token rotacionado for usado novamente, a versão não bate e a sessão é invalidada imediatamente.
