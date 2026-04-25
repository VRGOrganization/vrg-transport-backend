# Tratamento de erros

## Formato geral

O filtro global retorna respostas no formato:

```json
{
  "statusCode": 400,
  "message": "...",
  "timestamp": "2026-04-19T14:00:00.000Z",
  "path": "/api/v1/..."
}
```

## Códigos mais comuns

| Código | Quando aparece |
|---|---|
| 400 | DTO inválido, regra de negócio inválida, ID inválido, janela fora do período |
| 401 | sessão inválida/expirada, credenciais inválidas, secret inválido |
| 403 | role sem permissão |
| 404 | recurso não encontrado |
| 409 | conflito de unicidade ou concorrência |
| 429 | rate limit excedido |
| 500 | erro interno não tratado |
| 502 | falha no serviço externo |
| 504 | timeout no serviço externo |

## Casos recorrentes no fluxo atual

- tentativa de inscrição inicial fora da janela do período
- tentativa de aprovar request em estado inválido
- tentativa de criar ônibus, curso, faculdade ou funcionário duplicado
- uso de `inactive` em rota sem path explícito
- corrida entre aprovação e promoção de fila

## Como o front deve reagir

- `400`: mostre validação/regra
- `401`: peça login novamente
- `403`: acesso negado por papel
- `409`: recarregue estado e tente novamente
- `502/504`: mostre indisponibilidade do emissor externo
