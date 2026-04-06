# Segurança

## Camadas de Segurança

### 1. Helmet (Headers HTTP)

**O que faz:** Configura headers HTTP defensivos automaticamente.  
**Onde:** `main.ts`, aplicado antes de qualquer rota.  
**Headers incluídos:** `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `X-XSS-Protection`, entre outros.  
**Por que foi adicionado:** Mitiga vetores de ataque comuns no navegador (clickjacking, MIME sniffing, etc.).

```typescript
app.use(helmet());
app.disable('x-powered-by'); // Remove header que identifica NestJS/Express
```

---

### 2. CORS

**O que faz:** Restringe quais origens podem fazer requisições cross-origin.  
**Onde:** `main.ts`, configurado via `ALLOWED_ORIGINS`.  
**Por que foi adicionado:** Sem CORS restritivo, qualquer site pode fazer requisições autenticadas em nome de um usuário logado.

**Política:**
- Origens permitidas definidas em `ALLOWED_ORIGINS` (separadas por vírgula)
- Wildcard (`*`) é **rejeitado na validação de startup** — a API não inicializa com `ALLOWED_ORIGINS=*`
- Métodos: GET, POST, PATCH, DELETE, OPTIONS
- Headers: `Content-Type`, `x-session-id`, `x-service-secret`
- Credentials: habilitado

**Configuração para produção:**
```
ALLOWED_ORIGINS=https://app.vrgtransport.com.br,https://admin.vrgtransport.com.br
```

---

### 3. Limite de Body (2MB)

**O que faz:** Rejeita requests com body maior que 2MB antes de qualquer parsing.  
**Onde:** `main.ts`, configurado no Express antes do NestJS processar a requisição.  
**Por que está antes do ValidationPipe:** Se o limite fosse aplicado após o parse, o servidor já teria consumido memória para desserializar um payload grande. O limite no Express bloqueia o payload ainda em bytes brutos.

---

### 4. ValidationPipe Global

**O que faz:** Valida e transforma o body de todas as requisições.  
**Onde:** `main.ts`, aplicado globalmente.  
**Configuração:**

| Opção | Valor | Efeito |
|---|---|---|
| `whitelist` | `true` | Remove campos não declarados nos DTOs silenciosamente |
| `forbidNonWhitelisted` | `true` | Retorna erro se campos desconhecidos forem enviados |
| `forbidUnknownValues` | `true` | Erro em objetos sem decorators de validação |
| `transform` | `true` | Aplica transformações (@Transform) automaticamente |
| `validationError.value` | `false` | Não expõe o valor inválido na mensagem de erro |

---

### 5. MongoObjectIdPipe

**O que faz:** Valida se parâmetros `:id` são ObjectIds MongoDB válidos.  
**Onde:** Aplicado em todos os endpoints que recebem `:id` ou `:studentId`.  
**Por que foi adicionado:** Queries MongoDB com um id inválido lançam exceções genéricas. O pipe retorna `400 Bad Request` antes de chegar ao banco.

---

### 6. Sessão server-side

**O que faz:** Autenticação por sessão com revogação imediata e expiração por TTL.  
**Onde:** `auth.service.ts`, `session.service.ts` e `session-auth.guard.ts`.

**Detalhes de implementação:**
- O backend cria um `sessionId` e retorna ao BFF
- O BFF grava o cookie httpOnly `sid` e envia `x-session-id` ao backend
- O backend valida a sessão antes de cada request autenticado
- Sessão pode ser revogada a qualquer momento (logout idempotente)

---

### 7. Hashing de Senhas (bcrypt)

**O que faz:** Hash unidirecional de senhas com salt.  
**Onde:** `auth.service.ts`, constante `SALT_ROUNDS = 12`.  
**Por que 12 rounds:** Equilíbrio entre segurança e performance — aumentar para 14+ adiciona latência perceptível sem ganho proporcional.

---

### 8. OTP com HMAC + Pepper

**O que faz:** Protege os códigos de verificação de e-mail.  
**Onde:** `auth.service.ts`, método `hashVerificationCode`.

**Implementação:**
- Código gerado: 6 dígitos aleatórios (criptograficamente seguros)
- Armazenado como `HMAC-SHA256(código, OTP_PEPPER)` — nunca em texto plano
- Verificação com `timingSafeEqual` (previne timing attacks)
- Expira em 15 minutos
- Máximo de 5 tentativas antes de bloquear por 60 segundos

---

### 9. Rate Limiting

**O que faz:** Limita requisições por IP por endpoint.  
**Onde:** `RateLimitGuard` aplicado globalmente; limites configurados por decorator nos controllers.  
**Por que foi adicionado:** Previne ataques de força bruta e abuso de endpoints de e-mail.

Ver tabela completa em [autenticação](./authentication.md#política-de-rate-limiting).

**Trust Proxy:**  
Se a API estiver atrás de um proxy reverso (Nginx, Cloudflare), configure `TRUST_PROXY_HOPS` para que o rate limiting use o IP real do cliente, não o IP do proxy.

```
TRUST_PROXY_HOPS=1  # Para 1 proxy reverso na frente
```

---

### 10. Proteção contra Enumeração de Usuários

**O que faz:** Retorna a mesma mensagem de erro para e-mail não cadastrado e credenciais inválidas.  
**Onde:** `auth.service.ts`, mensagens de erro nos fluxos de login e verificação.  
**Por que:** Respostas diferentes permitiriam descobrir quais e-mails estão cadastrados.

---

### 11. Campos Sensíveis Excluídos das Queries

**O que faz:** Campos como `password`, `verificationCode`, `refreshTokenHash` não são retornados em queries padrão.  
**Onde:** Schemas Mongoose com `select: false`.  
**Por que:** Evita expor dados sensíveis em endpoints que retornam o objeto do usuário.

Campos com `select: false`:
- `password`
- `verificationCode`
- `verificationCodeExpiresAt`
- `verificationCodeAttempts`
- `verificationCodeLockedUntil`
- `verificationCodeLastSentAt`
- `refreshTokenHash`
- `refreshTokenVersion`

Além disso, `StudentSchema.set('toJSON', ...)` remove esses campos mesmo quando carregados explicitamente.

---

### 12. Audit Log

**O que faz:** Registra eventos sensíveis com dados redatados.  
**Onde:** `audit-log.service.ts`, chamado pelo `AuthService`.  
**Dados redatados:** E-mail, telefone e código OTP são armazenados como `hash:xxxxxxxx` — nunca em texto plano nos logs.

---

### 13. Swagger Protegido

**O que faz:** UI de documentação disponível apenas em desenvolvimento.  
**Onde:** `main.ts`, condicionado a `NODE_ENV !== 'production' && ENABLE_SWAGGER === 'true'`.  
**Por que:** Documentação pública expõe a superfície de ataque da API.

---

## Recomendações para Produção

| Item | Ação necessária |
|---|---|
| Swagger | Certifique-se de que `NODE_ENV=production` — Swagger é bloqueado automaticamente |
| CORS | Defina origens explícitas em `ALLOWED_ORIGINS` (sem wildcard) |
| HTTPS | Configure TLS no proxy reverso (Nginx/Caddy); a API não gerencia TLS diretamente |
| Trust Proxy | Configure `TRUST_PROXY_HOPS` de acordo com sua infraestrutura |
| MongoDB | Ative autenticação e TLS na string de conexão (`?authSource=admin&tls=true`) |
| Secrets | Nunca comite `.env` no repositório; use um gerenciador de secrets em produção |
| SERVICE_SECRET | Use secrets de pelo menos 64 caracteres em produção |
| Logs | Garanta que logs não vazam em ambientes de produção (stack traces desabilitados pelo `HttpExceptionFilter`) |
