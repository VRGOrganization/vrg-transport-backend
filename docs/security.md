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

## Pontos funcionais importantes

- `GET /license/verify/:code` é público, mas só valida o código.
- `POST /license/events/token` exige estudante autenticado e gera ticket de uso único.
- `POST /student/me/license-submit` valida elegibilidade antes de persistir a solicitação.
- fila, promoção e aprovação foram pensadas para evitar dupla execução em corrida.

## Recomendações operacionais

- usar `NODE_ENV=production` em produção
- manter `ALLOWED_ORIGINS` restrito
- rotacionar `SERVICE_SECRET`, `OTP_PEPPER` e `CPF_HMAC_SECRET`
- monitorar 401, 403, 409 e 429
