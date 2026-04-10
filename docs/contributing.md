# Contribuindo

## Pré-requisitos

- Node.js 22+
- npm 10+
- MongoDB local ou ambiente docker

## Fluxo recomendado

1. Criar branch (`feat/...`, `fix/...`, `docs/...`)
2. Implementar mudanças com testes
3. Atualizar documentação em `docs/`
4. Abrir PR com descrição objetiva

## Padrões de código

- TypeScript com tipagem explícita quando necessário
- DTOs com `class-validator` e `class-transformer`
- Controllers finos, regras em services
- Repositórios para acesso a dados dos módulos de domínio
- Uso de `MongoObjectIdPipe` em parâmetros de ID
- Uso de `@Roles(...)` em endpoints protegidos por perfil

## Scripts úteis

```bash
npm run start:dev
npm run build
npm run lint
npm run test
npm run test:e2e
npm run seed:admin
```

## Convenção de commit

Conventional Commits:

- `feat:` nova funcionalidade
- `fix:` correção de bug
- `docs:` documentação
- `refactor:` refatoração sem mudar comportamento
- `test:` testes
- `chore:` manutenção

## Checklist de PR

- [ ] Mudança atende o requisito funcional
- [ ] DTOs/guards/roles revisados
- [ ] Testes locais executados (quando aplicável)
- [ ] Documentação em `docs/` atualizada
- [ ] Sem segredos em código ou commit
