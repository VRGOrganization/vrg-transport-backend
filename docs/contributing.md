# Contribuindo

## Pré-requisitos

- Node.js >= 22
- npm >= 10
- MongoDB local ou Atlas
- Leia [getting-started.md](./getting-started.md) antes de começar

---

## Nomenclatura de Arquivos e Classes

| Artefato | Padrão | Exemplo |
|---|---|---|
| Arquivos | `kebab-case` | `student.service.ts` |
| Classes | `PascalCase` | `StudentService` |
| Interfaces | `PascalCase` com `I` prefixo | `IStudentRepository` |
| Enums | `PascalCase` | `UserRole`, `BloodType` |
| DTOs | `PascalCase` + sufixo `Dto` | `CreateStudentDto`, `UpdateStudentDto` |
| Schemas Mongoose | `PascalCase` + sufixo `Schema` | `StudentSchema` |
| Guards | `PascalCase` + sufixo `Guard` | `SessionAuthGuard`, `RolesGuard` |
| Pipes | `PascalCase` + sufixo `Pipe` | `MongoObjectIdPipe` |
| Filtros | `PascalCase` + sufixo `Filter` | `HttpExceptionFilter` |

---

## Criando um Novo Módulo

Siga a estrutura dos módulos existentes (Student ou Employee como referência):

```
src/[modulo]/
├── [modulo].module.ts
├── [modulo].controller.ts
├── [modulo].service.ts
├── schemas/
│   └── [modulo].schema.ts
├── repositories/
│   ├── [modulo].repository.interface.ts
│   └── [modulo].repository.ts
└── dto/
    ├── create-[modulo].dto.ts
    └── update-[modulo].dto.ts (geralmente Partial do Create)
```

**Passos:**

1. Crie a estrutura de arquivos acima
2. Defina o schema Mongoose com `select: false` em campos sensíveis
3. Defina a interface do repository com os métodos necessários
4. Implemente o repository usando Mongoose
5. Crie os DTOs com decorators de `class-validator`
6. Implemente o service usando a interface do repository (não a implementação direta)
7. Implemente o controller com `@UseGuards(SessionAuthGuard, RolesGuard)` e `@Roles(...)` por endpoint
8. Registre o módulo em `AppModule`

**Regra:** O service nunca importa a implementação concreta do repository — apenas a interface. Injete via token de provider:

```typescript
// [modulo].module.ts
providers: [
  {
    provide: 'IStudentRepository',
    useClass: StudentRepository,
  },
  StudentService,
],
```

```typescript
// [modulo].service.ts
constructor(
  @Inject('IStudentRepository')
  private readonly studentRepository: IStudentRepository,
) {}
```

---

## Padrão de DTO

Sempre use `class-validator` e `class-transformer`:

```typescript
import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateExampleDto {
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;
}
```

`UpdateExampleDto` deve ser `PartialType(CreateExampleDto)` do `@nestjs/mapped-types`.

---

## Executando Testes

```bash
# Testes unitários
npm run test

# Testes unitários com watch
npm run test:watch

# Cobertura
npm run test:cov

# Testes e2e
npm run test:e2e
```

> Verifique se há configuração de testes em `jest.config.ts` ou `package.json` antes de rodar.

---

## Convenções de Commit

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>(<escopo>): <descrição curta em minúsculas>

[corpo opcional]

[rodapé opcional]
```

| Tipo | Quando usar |
|---|---|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `refactor` | Refatoração sem mudança de comportamento |
| `test` | Adição ou correção de testes |
| `docs` | Documentação |
| `chore` | Tarefas de manutenção (deps, configs) |
| `perf` | Melhoria de performance |
| `security` | Correção de vulnerabilidade |

**Exemplos:**

```
feat(auth): adicionar verificação de e-mail por OTP
fix(student): corrigir query de busca por status
docs(auth): documentar fluxo de refresh token
chore(deps): atualizar NestJS para 11.0.5
```

---

## Checklist de PR

Antes de abrir um Pull Request, verifique:

- [ ] O código segue a estrutura de módulos definida neste guia
- [ ] Campos sensíveis nos schemas Mongoose têm `select: false`
- [ ] DTOs usam `class-validator` com mensagens em português
- [ ] Endpoints novos têm `@UseGuards(SessionAuthGuard, RolesGuard)` e `@Roles(...)` aplicados
- [ ] Parâmetros `:id` usam `MongoObjectIdPipe`
- [ ] Rotas públicas têm `@Public()` explicitamente
- [ ] Não há segredos (passwords, tokens, keys) hardcoded no código
- [ ] O arquivo `.env` **não** está incluído no commit
- [ ] Testes unitários foram adicionados ou atualizados
- [ ] Testes passam localmente (`npm run test`)
- [ ] O `CHANGELOG` ou PR description descreve a mudança
- [ ] Se adicionou endpoint novo, a documentação em `docs/api-reference/` foi atualizada

---

## Estrutura de Branch

| Padrão | Uso |
|---|---|
| `feat/<descricao>` | Nova funcionalidade |
| `fix/<descricao>` | Correção de bug |
| `refactor/<descricao>` | Refatoração |
| `docs/<descricao>` | Documentação |
| `chore/<descricao>` | Manutenção |

PRs devem ser abertos contra a branch `main` (ou `develop`, se existir).
