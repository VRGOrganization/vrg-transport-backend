# Seguranca

## Camadas ativas

1. Config fail-fast
	- validateSecurityConfig interrompe bootstrap se env critica estiver ausente.

2. Hardening HTTP
	- helmet com CSP, HSTS e headers de protecao.
	- Permissions-Policy definido no bootstrap.

3. CORS restrito
	- ALLOWED_ORIGINS obrigatorio, sem wildcard.
	- headers permitidos: Content-Type, x-session-id, x-service-secret.

4. Limite de payload
	- body parser com limite de 2MB.

5. Validacao global
	- ValidationPipe com whitelist, forbidNonWhitelisted e transform.

6. Sessao server-side
	- SessionAuthGuard global valida x-session-id.

7. Controle de acesso por role
	- RolesGuard global + decorators por endpoint.

8. Segredo de servico no Auth
	- ServiceSecretGuard no AuthController com comparacao timing-safe.

9. Rate limiting
	- RateLimitGuard por endpoint.
	- chave por usuario autenticado ou IP em rotas publicas.

10. Credenciais e OTP
	 - senha com bcrypt.
	 - OTP com expiração e controle de tentativas.

11. Dados sensiveis
	 - CPF persistido como hash (cpfHash).
	 - stack 5xx nao e retornada ao cliente.

12. Auditoria
	 - eventos criticos registrados por AuditLogService.

## Pontos de seguranca funcionais do fluxo novo

- Fila com atualizacao atomica de posicao.
- Promocao de waitlist atomica para evitar dupla promocao.
- Validacao de elegibilidade inicial antes de side effects no submit.
- Conflito de unicidade de periodo ativo tratado com resposta de conflito.

## Recomendacoes de operacao

- Use NODE_ENV=production em producao.
- Restrinja ALLOWED_ORIGINS aos domínios reais.
- Rotacione SERVICE_SECRET, OTP_PEPPER e CPF_HMAC_SECRET.
- Monitore picos de 401, 403, 409 e 429.
- Centralize logs de auditoria e erros.
