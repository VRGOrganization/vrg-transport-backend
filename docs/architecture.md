# Arquitetura

## Estrutura de alto nivel

src/
  main.ts
  app.module.ts
  auth/
  student/
  employee/
  admin/
  image/
  license/
  license-request/
  enrollment-period/
  mail/
  common/

## Modulos e responsabilidades

- AppModule
  - Config global e conexoes Mongo
  - Registro dos modulos de dominio
  - Guards globais de sessao, rate limit e role

- AuthModule
  - Registro/login por perfil
  - OTP e verificacao de conta
  - Sessao server-side
  - ServiceSecretGuard no controller de auth

- StudentModule
  - Perfil, horario e envio inicial de documentos
  - Endpoint unico de submit inicial
  - Pedido de alteracao de documentos

- EnrollmentPeriodModule
  - Criacao e administracao de periodos de inscricao
  - Preview e confirmacao de liberacao de fila
  - Encerramento da fila no fim do ciclo do periodo

- LicenseRequestModule
  - Solicitacoes initial e update
  - Estados pending/approved/rejected/cancelled/waitlisted
  - Aprovacao com controle atomico de vagas

- LicenseModule
  - Emissao e atualizacao de carteirinhas
  - SSE por ticket efemero
  - Verificacao publica por codigo
  - Desativacao de licencas expiradas

- ImageModule
  - Armazenamento de foto e documentos
  - Historico de versoes para updates

## Modelo de dados relevante ao fluxo novo

- enrollment_periods
  - janela: dataInicio/dataFim
  - capacidade: qtdVagasTotais/qtdVagasPreenchidas
  - validade: validadeCarteirinhaMeses
  - fila: waitlistSequence, qtdFilaEncerrada, filaEncerradaEm

- license_requests
  - type: initial/update
  - status: pending/approved/rejected/cancelled/waitlisted
  - vinculo de ciclo: enrollmentPeriodId
  - fila: filaPosition

- licenses
  - status: active/inactive/expired/rejected
  - existing: soft delete funcional
  - expirationDate
  - vinculo ao periodo: enrollmentPeriodId

## Conexoes de banco

| Conexao | Variavel | Uso |
|---|---|---|
| Principal | MONGODB_URI | estudantes, funcionarios, admins, periodos, solicitacoes, licencas |
| Imagens (connection images) | MONGODB_URI_IMAGE | imagens e historico de imagens |

## Pipeline de requisicao

Guards globais:

1. SessionAuthGuard
2. RateLimitGuard
3. RolesGuard

No modulo Auth, alem dos globais:

- ServiceSecretGuard
- rate limit por endpoint com decorator RateLimit

## Fluxos criticos

### Fluxo de solicitacao inicial

1. Student envia POST /student/me/license-submit com multipart.
2. Controller valida elegibilidade antes de side effects.
3. Service cria request initial:
   - pending quando ha vaga
   - waitlisted quando nao ha vaga
4. Em waitlist, filaPosition e gerada de forma atomica no periodo.

### Fluxo de liberacao de fila

1. Admin faz preview de slots do periodo.
2. Admin confirma requestIds.
3. Promocao waitlisted -> pending e atomica por request.
4. Fila remanescente e reindexada.

### Fluxo de aprovacao

1. Employee/Admin aprova request pending.
2. Para initial com periodo vinculado:
   - incrementa vagas preenchidas de forma atomica
   - emite licenca vinculada ao periodo
3. Em erro de emissao, faz rollback de vaga preenchida.

### Ciclo de vida do periodo

1. Periodo ativo com janela vencida e finalizado ao ser consultado/criar novo.
2. Fila waitlisted do periodo e cancelada em lote no encerramento.
3. Historico do tamanho da fila encerrada permanece no periodo.

### Validade e expiracao de carteirinhas

1. Se validadeCarteirinhaMeses mudar, licencas ativas daquele periodo sao ajustadas por delta.
2. Licencas expiradas sao desativadas em lote (status expired + existing false).

## Bootstrap e seguranca de entrada

- Prefixo global /api/v1
- ValidationPipe global (whitelist, forbidNonWhitelisted, transform)
- HttpExceptionFilter global
- Body limit 2MB
- helmet + CSP + HSTS
- CORS por ALLOWED_ORIGINS
