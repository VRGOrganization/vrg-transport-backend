import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LicenseService } from '../license/license.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

@Injectable()
export class LicenseExpirationJobService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LicenseExpirationJobService.name);
  private readonly cronJobName = 'license-expiration-job';
  private cronJob?: CronJob;
  private running = false;

  constructor(
    private readonly licenseService: LicenseService,
    private readonly configService: ConfigService,
    private readonly auditLog: AuditLogService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    const enabled = this.configService.get('LICENSE_EXPIRATION_JOB_ENABLED') !== 'false';
    if (!enabled) {
      this.logger.log('License expiration job disabled (LICENSE_EXPIRATION_JOB_ENABLED=false)');
      return;
    }

    const cronExpression = this.getCronExpression();
    try {
      this.cronJob = CronJob.from({
        cronTime: cronExpression,
        onTick: () => {
          void this.runExpirationCycle('cron');
        },
        start: false,
        timeZone: 'America/Sao_Paulo',
      });

      this.schedulerRegistry.addCronJob(this.cronJobName, this.cronJob);
      this.cronJob.start();
      this.logger.log(`License expiration job agendado com cron ${cronExpression}`);
    } catch (err) {
      this.logger.warn(`Falha ao registrar cron do job de expiracao: ${(err as Error)?.message}`);
      return;
    }

    await this.runExpirationCycle('startup');
  }

  onModuleDestroy() {
    if (this.cronJob) {
      try {
        this.cronJob.stop();
      } catch {
        // ignore shutdown errors
      }

      try {
        this.schedulerRegistry.deleteCronJob(this.cronJobName);
      } catch {
        // ignore shutdown errors
      }

      this.cronJob = undefined;
    }
  }

  async runExpirationCycle(trigger: 'startup' | 'cron' | 'manual' = 'manual'): Promise<{
    status: 'success' | 'failure' | 'skipped';
    deactivatedCount: number;
  }> {
    if (this.running) {
      this.logger.warn(`License expiration job skipped porque uma execucao ainda esta em andamento (${trigger})`);
      return { status: 'skipped', deactivatedCount: 0 };
    }

    this.running = true;
    const startedAt = new Date();

    try {
      const deactivatedCount = await this.licenseService.deactivateExpiredLicenses();
      const finishedAt = new Date();

      await this.auditLog.record({
        action: 'license_expiration_job.run',
        outcome: 'success',
        actor: null,
        target: {},
        metadata: {
          trigger,
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          deactivatedCount,
          status: 'success',
        },
      }).catch(() => {});

      this.logger.log(
        `License expiration job executado com sucesso (${trigger}) - ${deactivatedCount} licencas desativadas`,
      );

      return { status: 'success', deactivatedCount };
    } catch (err) {
      await this.auditLog.record({
        action: 'license_expiration_job.run',
        outcome: 'failure',
        actor: null,
        target: {},
        metadata: {
          trigger,
          startedAt: startedAt.toISOString(),
          status: 'failure',
          error: (err as Error)?.message,
        },
      }).catch(() => {});

      this.logger.warn(
        `Falha ao executar deactivateExpiredLicenses (${trigger}): ${(err as Error)?.message}`,
      );

      return { status: 'failure', deactivatedCount: 0 };
    } finally {
      this.running = false;
    }
  }

  private getCronExpression(): string {
    return this.configService.get('LICENSE_EXPIRATION_CRON') ?? '0 0 * * * *';
  }
}
