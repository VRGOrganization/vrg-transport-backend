# Tratamento de Erros

## Padrao de resposta

As excecoes passam pelo HttpExceptionFilter global.

Formato padrao:

{
  "statusCode": 400,
  "message": "...",
  "timestamp": "2026-04-10T15:00:00.000Z",
  "path": "/api/v1/..."
}

Observacoes:

- path aparece fora de producao
- mensagens 5xx sao sanitizadas para o cliente

## Codigos usados com mais frequencia

| Codigo | Quando aparece |
|---|---|
| 400 | DTO invalido, regra de negocio invalida, janela fora do periodo |
| 401 | Sessao invalida/expirada, credenciais invalidas, secret invalido |
| 403 | Role sem permissao |
| 404 | Recurso nao encontrado |
| 409 | Conflito de unicidade ou concorrencia de operacao |
| 429 | Rate limit excedido |
| 500 | Erro interno nao tratado |
| 502 | Falha no servico externo de emissao |
| 504 | Timeout no servico externo de emissao |

## Casos importantes do fluxo de inscricao

- 400
  - tentativa de solicitacao inicial fora da janela
  - tentativa de reabrir periodo com janela encerrada
  - payload de confirm-release com IDs duplicados

- 409
  - create/reopen de periodo com conflito de ativo (inclusive E11000)
  - aprovacao de request sem vaga disponivel em corrida
  - confirm-release em que nada foi promovido por corrida

## Exemplos

Sem permissao:

{
  "statusCode": 403,
  "message": "Voce nao tem permissao para acessar este recurso",
  "timestamp": "..."
}

Conflito de periodo ativo:

{
  "statusCode": 409,
  "message": "Ja existe um periodo de inscricao ativo.",
  "timestamp": "..."
}
