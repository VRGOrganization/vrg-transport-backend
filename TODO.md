# Retomada - 20/04/2026

Resumo do estado:
- Data: 20/04/2026
- Estado atual: Backend com testes verdes (20 suites, 106 testes).
- Backend: implementado `releaseSlotsForBus` com `quantity`, `resetUniversityFilledSlots` aceita `quantity`, validação em EnrollmentPeriod (`totalSlots >= soma(capacidades onibus)`), removidos métodos/endpoint de preview/confirm de release por período.
- Frontend: `StudentListPanel` atualizado para regra de prioridade dinâmica; `AdminCardsPage` passa `bus`. NSFW fallback já implementado.

Próximos passos para retomar amanhã:
1. Implementar `BusReleaseModal` e integrar com `PATCH /bus/:id/release-slots?quantity=N`.
2. Adicionar handlers MSW para `GET /api/v1/university` nos testes frontend.
3. Verificação manual da UI em `/employee/cards`.
4. Ajustes finais, commit e abrir PR.

Arquivos-chave (alterados/para revisar):
- src/bus/bus.service.ts
- src/bus/repository/bus.repository.ts
- src/bus/interface/repository.interface.ts
- src/enrollment-period/enrollment-period.service.ts
- src/components/cards/StudentListPanel.tsx
- src/app/(auth)/admin/cards/page.tsx

Observações rápidas:
- Backend já pronto para commit (testes verdes).
- Testes frontend precisam de MSW handlers para evitar warnings e simular universidades.

Use este arquivo para retomar o trabalho amanhã e seguir a ordem dos TODOs.

# TODO

## Job Agendado de Expiracao de Carteirinhas

- [ ] Adicionar dependencia de scheduler com @nestjs/schedule.
- [ ] Registrar ScheduleModule.forRoot() no modulo principal da aplicacao.
- [ ] Criar servico LicenseExpirationJobService para executar varredura periodica.
- [ ] Agendar execucao com cron para chamar LicenseService.deactivateExpiredLicenses().
- [ ] Tornar o cron configuravel por variavel de ambiente LICENSE_EXPIRATION_CRON.
- [ ] Permitir desabilitar o job por variavel de ambiente LICENSE_EXPIRATION_JOB_ENABLED.
- [ ] Registrar auditoria por execucao: total de licencas desativadas, horario e status.
- [ ] Evitar sobreposicao de execucoes concorrentes no mesmo processo com lock em memoria.
- [ ] Cobrir com testes unitarios:
  - [ ] Executa quando habilitado.
  - [ ] Nao executa quando desabilitado.
  - [ ] Trata erro sem derrubar o scheduler.
  - [ ] Nao roda em paralelo quando ja existe execucao ativa.
- [ ] Atualizar documentacao tecnica com cron e variaveis de ambiente.

## Criterios de Pronto

- [ ] Job executa automaticamente sem depender de chamadas de API de periodo.
- [ ] Licencas expiradas mudam para status expired e existing=false.
- [ ] Testes unitarios do job passando.
- [ ] Suite completa de testes do projeto passando.

## Gestao de Faculdades e Cursos (Admin)

- [ ] Criar modulo de dominio para instituicoes e cursos (ex.: InstitutionModule).
- [ ] Modelar Institution com nome unico, status ativo/inativo e metadados de auditoria.
- [ ] Modelar Course com vinculo obrigatorio a Institution e nome unico por instituicao.
- [ ] Criar CRUD de Institution restrito a ADMIN:
  - [ ] Criar instituicao.
  - [ ] Listar instituicoes (com filtro por ativo).
  - [ ] Atualizar instituicao.
  - [ ] Inativar instituicao (soft delete).
- [ ] Criar CRUD de Course restrito a ADMIN:
  - [ ] Criar curso dentro de instituicao.
  - [ ] Listar cursos por instituicao.
  - [ ] Atualizar curso.
  - [ ] Inativar curso (soft delete).
- [ ] Impedir criacao de curso em instituicao inativa.
- [ ] Impedir duplicidade de nomes considerando normalizacao (trim/lowercase).
- [ ] Registrar auditoria para create/update/deactivate de instituicoes e cursos.
- [ ] Atualizar DTOs/fluxos para usar IDs de instituicao/curso quando aplicavel (em vez de texto livre).

## Gestao de Rotas de Onibus (Admin)

- [ ] Criar modulo de dominio para rotas de onibus (ex.: BusRouteModule).
- [ ] Modelar BusRoute com numero da linha e status ativo/inativo.
- [ ] Modelar destinos da linha permitindo mais de um destino por rota.
- [ ] Garantir unicidade do numero da linha por rota ativa.
- [ ] Criar CRUD de BusRoute restrito a ADMIN:
  - [ ] Criar rota com numero e lista de destinos.
  - [ ] Listar rotas com destinos.
  - [ ] Atualizar numero da linha.
  - [ ] Adicionar/remover destinos da rota.
  - [ ] Inativar rota (soft delete).
  - [ ] Adicionar periodo aos onibus(Manhã, Tarde, Noite)
- [ ] Validar regra: rota deve ter pelo menos 1 destino ativo.
- [ ] Atualizar fluxo de aprovacao para selecionar rota cadastrada (linha + destino), evitando texto livre.
- [ ] Registrar auditoria para create/update/deactivate de rotas e destinos.


## Criar Licence-Request
- [x] Associar entidades faculdade ao pedido
- [x] Ao selecionar o direcionamento do onibus vinculado ao pedido, levar em consideracao o turno do aluno com o turno do onibus. Ex. Onibus 06 atende ao iff a noite, onibus 02 atende ao iff de manha, aluno faz pedido de inscricao para iff estudando a noite, o request dele deve ser irecionado as vagas do onibus do 06 que corresponde a faculdade e ao turno


## Criterios de Pronto (Catalogos de Negocio)

- [ ] ADMIN consegue gerir instituicoes, cursos e rotas por endpoints dedicados.
- [ ] Rotas aceitam 1..N destinos por linha.
- [ ] Fluxos de aprovacao usam dados de catalogo validados.
- [ ] Cobertura de testes unitarios e e2e dos novos modulos.
- [ ] Documentacao de API e roteiro manual atualizados.

## Auditoria: Lista priorizada de 25 tarefas

- [x] 1. Remover ModuleRef em LicenseService
- [x] 2. Remover ModuleRef em StudentController
- [x] 3. Corrigir double increment em approve
- [x] 4. Mover orquestração para LicenseRequestService
- [x] 5. Alterar update de licença para update
- [x] 6. Adicionar audit log em remove de licença
- [x] 7. Aceitar/rejeitar WAITLISTED corretamente
- [x] 8. Mover deactivateExpiredLicenses para Cron
- [x] 9. Querys no repo para queue counts
- [x] 10. Unificar assertInitialRequestEligibility
- [x] 11. Remover OTP debug em auth.service
- [x] 12. Adicionar enum LicenseRequest.type
- [x] 13. Centralizar REJECTION_REASONS constante
- [x] 14. Corrigir date.utils timezone handling
- [x] 15. Usar enum em LicenseRepository.remove
- [x] 16. Remover campo timestamp em AuditEvent
- [x] 17. Validar FRONTEND_URL no bootstrap
- [x] 18. Reordenar guards em app.module
- [x] 19. Não exportar token do repositório
- [x] 20. Corrigir StudentRepository.findByBus
- [x] 21. Criar método findWaitlisted
- [x] 22. Substituir N+1 por bulkWrite
- [x] 24. Centralizar validador de senhas
- [x] 25. Criar UpdateLicenseDto




