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
- [ ] Validar regra: rota deve ter pelo menos 1 destino ativo.
- [ ] Atualizar fluxo de aprovacao para selecionar rota cadastrada (linha + destino), evitando texto livre.
- [ ] Registrar auditoria para create/update/deactivate de rotas e destinos.

## Criterios de Pronto (Catalogos de Negocio)

- [ ] ADMIN consegue gerir instituicoes, cursos e rotas por endpoints dedicados.
- [ ] Rotas aceitam 1..N destinos por linha.
- [ ] Fluxos de aprovacao usam dados de catalogo validados.
- [ ] Cobertura de testes unitarios e e2e dos novos modulos.
- [ ] Documentacao de API e roteiro manual atualizados.
