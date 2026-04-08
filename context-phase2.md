Memoria de contexto — usar no inicio da Fase 3
Data: 2026-04-06

Objetivo da Fase 2
Refatorar o backend de autenticacao para modelo session-first (BFF-oriented), removendo fluxo de tokens legados no contrato HTTP e forçando breaking change imediato.

Decisoes fechadas nesta fase
- Somente o BFF deve escrever cookie sid no browser.
- Backend nao retorna mais token de acesso no body.
- Endpoint de refresh foi removido.
- Logout agora e idempotente: sempre retorna sucesso, com ou sem sessao valida.
- Aplicacao de seguranca maxima no backend ja nesta fase.
- Trabalho backend completo para student, employee e admin.
- Desenvolvimento em TDD (testes primeiro, depois implementacao).

O que foi implementado

1) Contrato novo de autenticacao (sem token no body)
Arquivo: src/auth/interfaces/auth.interface.ts
- Criado/ajustado para SessionAuthResponse:
  - { ok: true, sessionId, user }
- Criado SessionRequestContext:
  - { userAgent?, ipAddress? }
- Criado LogoutResponse:
  - { ok: true }

2) AuthService migrado para sessao
Arquivo: src/auth/auth.service.ts
- Removida logica de tokens legados.
- Login student/employee/admin:
  - valida credenciais
  - cria sessao via SessionService.createSession()
  - retorna SessionAuthResponse (ok + sessionId + user)
- Verify email student:
  - valida OTP
  - ativa conta
  - cria sessao
  - retorna SessionAuthResponse
- Logout:
  - idempotente
  - tenta revogar sessionId quando enviado
  - ignora falha de revoke e retorna { ok: true }

3) AuthController refatorado para BFF flow
Arquivo: src/auth/auth.controller.ts
- Removidos cookie writes e fluxo refresh.
- Endpoint /auth/refresh removido.
- Endpoints login/verify agora retornam SessionAuthResponse.
- Contexto de sessao (user-agent/ip) extraido de Request e enviado ao service.
- /auth/logout:
  - @Public()
  - le x-session-id quando existir
  - sempre retorna sucesso via AuthService.logout()
- /auth/me mantido com sessao validada pelo guard global.
- Controller protegido por ServiceSecretGuard (x-service-secret) para fluxo BFF->backend.

4) AuthModule simplificado
Arquivo: src/auth/auth.module.ts
- Removidos modules legados de token.
- Mantido APP_GUARD com SessionAuthGuard.
- Mantido SessionModule.
- Registrado ServiceSecretGuard.

5) Coesao de metadata @Public
Arquivos:
- src/auth/guards/session-auth.guard.ts
- src/auth/decorators/public.decorator.ts
- src/auth/constants/auth.constants.ts
A chave IS_PUBLIC_KEY foi centralizada pelo constants para evitar divergencia.

6) DTO de refresh removido
Arquivo: src/auth/dto/auth.dto.ts
- Removido RefreshTokenDto.

7) Correcoes de schema (suporte Nest Mongoose)
Arquivos:
- src/auth/session/session.schema.ts (fase anterior)
- src/student/schemas/student.schema.ts
- src/image/schema/image.schema.ts
Foram adicionados types explicitos em @Prop para evitar CannotDetermineTypeError.

8) Validacoes de ambiente endurecidas (fase 1.5/2)
Arquivo: src/common/config/security.validation.ts
- Validados SERVICE_SECRET e SESSION_TTL_DAYS (fail-fast).
- Validados BREVO_API_KEY e MAIL_FROM_ADDRESS.
- Comentario do arquivo atualizado para refletir o modelo atual.

Testes (TDD) entregues na Fase 2

Suites novas/ajustadas
- src/auth/tests/auth.service.spec.ts
  - login (student/employee/admin)
  - verify
  - logout idempotente
- src/auth/tests/auth.controller.spec.ts
  - me
  - propagacao de contexto no login
  - logout sem e com x-session-id
- src/auth/tests/session-auth.guard.spec.ts
  - rota publica
  - sem sessao
  - sessao invalida
  - sessao valida injeta request.user/request.sessionPayload
- src/auth/tests/roles.guard.spec.ts
  - ajuste de mock para considerar verificacao de @Public

Status de validacao
- npm test -- auth/tests: PASS (24/24)
- npm run build: PASS

Contrato backend apos Fase 2 (resumo)
- POST /auth/student/login -> { ok: true, sessionId, user }
- POST /auth/employee/login -> { ok: true, sessionId, user }
- POST /auth/admin/login -> { ok: true, sessionId, user }
- POST /auth/student/verify -> { ok: true, sessionId, user }
- POST /auth/logout -> { ok: true } (idempotente)
- GET /auth/me -> { userId, userType } (via sessao valida)


Importante de seguranca
- Backend nao seta mais cookie.
- BFF deve receber sessionId, persistir como cookie sid httpOnly e reenviar x-session-id ao backend.
- x-service-secret e obrigatorio para chamadas auth no backend.

Pendencias conhecidas para proxima fase
- Fase 3 (frontend student BFF):
  - criar rotas server-side /api/auth/login, /api/auth/logout, /api/auth/session
  - setar/limpar cookie sid apenas no Next
  - remover AuthContext legado e token legivel
  - substituir proxy.ts por middleware.ts nativo
- Atualizar Swagger/documentacao para contrato final BFF em todos os endpoints.
- Executar limpeza de campos legados no banco (atividade operacional separada):
  - refreshTokenHash / refreshTokenVersion em students/employees/admins

Checklist de aceite da Fase 2
- [x] Sem refresh endpoint
- [x] Sem retorno de token no body
- [x] Logout idempotente
- [x] Fluxo de sessao para student/employee/admin
- [x] Testes de auth da fase passando
- [x] Build do backend passando

Adendo de status atual (apos inicio da Fase 3)
- Este arquivo permanece como memoria historica da Fase 2 (backend).
- O frontend student ja iniciou migracao BFF/session-first e possui contexto proprio.
- As pendencias de "proxima fase" acima devem ser lidas como contexto original da epoca.
- Planejamento atual recomendado:
  - concluir validacao funcional ponta a ponta do student
  - finalizar limpeza de warnings e documentacao de contrato
  - iniciar migracao do frontend employee no mesmo padrao BFF/session-first
