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
