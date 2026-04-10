# Segurança

## Camadas ativas

### 1. Config fail-fast

No startup, `validateSecurityConfig` valida chaves obrigatórias de segurança e runtime. Se faltar valor crítico, a API não sobe.

### 2. Header hardening (`helmet`)

Aplicado em `main.ts` com:

- HSTS
- CSP
- cross-origin resource policy
- remoção de `x-powered-by`
- `Permissions-Policy` custom

### 3. CORS estrito

`ALLOWED_ORIGINS` obrigatório e sem wildcard.

Headers aceitos:

- `Content-Type`
- `x-session-id`
- `x-service-secret`
- `x-sse-ticket`

### 4. Limite de payload

Body parser manual com limite de 2MB (`json` e `urlencoded`) antes da cadeia do Nest.

### 5. ValidationPipe global

Configuração:

- `whitelist: true`
- `forbidNonWhitelisted: true`
- `forbidUnknownValues: true`
- `transform: true`

### 6. Autenticação por sessão

`SessionAuthGuard` global:

- lê `x-session-id`
- valida sessão em store
- injeta `request.sessionPayload` e `request.user`

### 7. Controle de acesso por role

`RolesGuard` global usando decorators `@Roles(...)`.

### 8. Proteção de endpoints de auth por segredo de serviço

`ServiceSecretGuard` no `AuthController` exige `x-service-secret` e compara em timing-safe.

### 9. Rate limiting

`RateLimitGuard` aplicado com decorator por endpoint, usando:

- `user:<id>` quando autenticado
- `ip:<ip>` quando público

### 10. Senhas e OTP

- Senhas com bcrypt (`SALT_ROUNDS = 12`)
- OTP com hash bcrypt + salt aleatório
- expiração de OTP em 15 min
- controles de tentativa e cooldown

### 11. Proteção de dados sensíveis

- CPF armazenado como hash (`cpfHash`)
- campos sensíveis ocultos no schema/toJSON
- filtro global sanitiza stack trace em erro 5xx

### 12. Auditoria

Ações críticas (registro, login, aprovar/rejeitar licença, etc.) são registradas por `AuditLogService`.

## Recomendações de produção

- Definir `NODE_ENV=production`
- Usar origens explícitas em `ALLOWED_ORIGINS`
- Configurar `TRUST_PROXY_HOPS` conforme infraestrutura
- Rotacionar `SERVICE_SECRET`, `OTP_PEPPER` e `CPF_HMAC_SECRET`
- Monitorar falhas 401/403/429 em observabilidade
