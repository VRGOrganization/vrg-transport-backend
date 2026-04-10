# Tratamento de Erros

## Estrutura padrão

Todas as exceções passam por `HttpExceptionFilter` global.

Formato:

```json
{
  "statusCode": 400,
  "message": "...",
  "timestamp": "2026-04-10T15:00:00.000Z",
  "path": "/api/v1/..."
}
```

Observações:

- `path` aparece fora de produção
- em erros 5xx, a mensagem ao cliente é sempre `Internal server error`
- stack de 5xx é sanitizada antes do log

## Códigos mais comuns

| Código | Situação típica |
|---|---|
| `400` | DTO inválido, ObjectId inválido, regra de negócio inválida |
| `401` | Sessão ausente/expirada, credenciais inválidas, secret inválido |
| `403` | Role sem permissão |
| `404` | Recurso não encontrado |
| `409` | Conflito de unicidade (e-mail/matrícula/imagem por tipo) |
| `429` | Limite de requisição excedido |
| `500` | Falha inesperada |
| `502` | Erro ao comunicar com API externa de licença |
| `504` | Timeout ao comunicar com API externa de licença |

## Exemplos práticos

### Sessão ausente

```json
{
  "statusCode": 401,
  "message": "Sessão não encontrada.",
  "timestamp": "..."
}
```

### Sem permissão

```json
{
  "statusCode": 403,
  "message": "Você não tem permissão para acessar este recurso",
  "timestamp": "..."
}
```

### Rate limit

```json
{
  "statusCode": 429,
  "message": "You have exceeded the maximum of 5 requests. Try again in 12 seconds.",
  "timestamp": "..."
}
```
