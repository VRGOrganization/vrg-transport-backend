# Contribuindo

## Pre-requisitos

- Node.js 22+
- npm 10+
- MongoDB local ou via Docker

## Fluxo recomendado

1. Crie branch por tema: feat, fix, docs, refactor ou test.
2. Aplique mudanca pequena e verificavel.
3. Rode testes afetados e depois suite completa.
4. Atualize docs na pasta docs quando houver mudanca de contrato/regra.
5. Abra PR com contexto, impacto e evidencias de teste.

## Padroes de codigo do projeto

- DTO com class-validator.
- Controller fino, regra no service.
- Repositorio para acesso a dados.
- Validacao de ID via MongoObjectIdPipe.
- Controle de acesso via decorator Roles.
- Trate concorrencia explicitamente em fluxos criticos.

## Scripts uteis

npm run start:dev
npm run build
npm run lint
npm test
npm run test:e2e
npm run seed:admin

## Convencao de commit

- feat: nova funcionalidade
- fix: correcao de bug
- docs: documentacao
- refactor: refatoracao sem mudanca funcional
- test: testes
- chore: manutencao

## Checklist de PR

- [ ] Regra de negocio validada
- [ ] Concorrencia revisada (quando aplicavel)
- [ ] DTO/guard/role revisados
- [ ] Testes unitarios e e2e executados
- [ ] Documentacao atualizada
- [ ] Sem segredo em commit
