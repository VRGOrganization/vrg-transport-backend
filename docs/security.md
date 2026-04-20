# Segurança

## Camadas ativas

1. **Fail-fast de configuração**
   - o bootstrap falha se variáveis críticas não existirem.

2. **Hardening HTTP**
   - `helmet`, CSP, HSTS e headers de proteção.

3. **CORS restrito**
   - controlado por `ALLOWED_ORIGINS`.

4. **Limite de payload**
   - body parser com limite ajustado ao uso do projeto.

5. **Validação global**
   - `ValidationPipe` com `whitelist`, `transform` e bloqueio de campos extras.

6. **Sessão server-side**
   - o backend não depende de JWT para rotas autenticadas.

7. **Controle de acesso por role**
   - `RolesGuard` + decorators por endpoint.

8. **Segredo de serviço no Auth**
   - o controller de auth é protegido por `ServiceSecretGuard`.

9. **Rate limit**
   - o rate limit roda antes da autenticação para contar rotas públicas também.

10. **Dados sensíveis**
   - CPF é persistido como hash.
   - OTP e tokens têm expiração.

11. **Auditoria**
   - ações críticas registram ator, alvo e outcome.

12. **Mascaramento e logs**
   - logs de produção devem mascarar dados sensíveis (CPF parcial, emails truncados) e NUNCA gravar OTPs.

13. **Conexões seguras**
   - exigir HTTPS/TLS em produção; aplicar HSTS e políticas de redirecionamento.

14. **Proteção de endpoints de fila**
   - endpoints que retornam contagens agregadas (`/bus/with-queue-counts`) não expõem dados pessoais; endpoints com `studentId` são restritos a `EMPLOYEE`/`ADMIN`.

## Pontos funcionais importantes

- `GET /license/verify/:code` é público, mas só valida o código.
- `POST /license/events/token` exige estudante autenticado e gera ticket de uso único.
- `POST /student/me/license-submit` valida elegibilidade antes de persistir a solicitação.
- fila, promoção e aprovação foram pensadas para evitar dupla execução em corrida.

## Controles operacionais

- Session cookie: configurar `HttpOnly`, `Secure` e `SameSite` apropriado.
- Rotacionar segredos: `SERVICE_SECRET`, `OTP_PEPPER`, `CPF_HMAC_SECRET` periodicamente.
- Auditoria: gravar actor, action, resource-id e outcome para operações críticas (approve, reject, release-slots).
- Monitorar padrões de erro 401/403/409/429 e configurar alertas.

## Proteção de dados PII

- CPF é armazenado como HMAC/hash e nunca retornado pelos endpoints padrão.
- Todos os endpoints que retornam listas de `LicenseRequest` para interfaces públicas devem omitir campos pessoais (name, email, telephone, cpfHash).


## Recomendações operacionais

- usar `NODE_ENV=production` em produção
- manter `ALLOWED_ORIGINS` restrito
- rotacionar `SERVICE_SECRET`, `OTP_PEPPER` e `CPF_HMAC_SECRET`
- monitorar 401, 403, 409 e 429
