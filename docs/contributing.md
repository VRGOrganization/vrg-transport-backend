# Contribuindo

## Antes de mudar código

- leia o contrato do módulo afetado em `docs/api-reference/`
- verifique se a mudança afeta front, backend ou ambos
- pense em concorrência se a regra envolver vaga, fila ou emissão de carteirinha

## Padrões do projeto

- DTO com `class-validator`
- controller fino
- regra no service
- repositório para acesso ao banco
- `MongoObjectIdPipe` para IDs de rota
- `Roles` para autorização
- `@Public()` somente quando fizer sentido
- docs atualizadas sempre que o contrato mudar

## Fluxo recomendado

1. Faça a menor mudança possível.
2. Atualize testes.
3. Rode `npm run build`.
4. Rode os testes afetados.
5. Atualize a documentação relacionada.

## Convenção de commits

- `feat:` nova funcionalidade
- `fix:` correção de bug
- `docs:` documentação
- `refactor:` refatoração sem mudança funcional
- `test:` testes
- `chore:` manutenção

## Checklist de PR

- [ ] regra de negócio validada
- [ ] impacto no front mapeado
- [ ] testes executados
- [ ] docs atualizadas
- [ ] sem segredo ou dado sensível
