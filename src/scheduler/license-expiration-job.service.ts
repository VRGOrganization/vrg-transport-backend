import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LicenseService } from '../license/license.service';

@Injectable()
export class LicenseExpirationJobService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LicenseExpirationJobService.name);
  private interval?: NodeJS.Timeout;

  constructor(
    private readonly licenseService: LicenseService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const enabled = this.configService.get('LICENSE_EXPIRATION_JOB_ENABLED') !== 'false';
    if (!enabled) {
      this.logger.log('License expiration job disabled (LICENSE_EXPIRATION_JOB_ENABLED=false)');
      return;
    }

    const intervalMs = Number(this.configService.get('LICENSE_EXPIRATION_INTERVAL_MS') ?? 1000 * 60 * 60);

    try {
      await this.licenseService.deactivateExpiredLicenses();
    } catch (err) {
      this.logger.warn(`Falha ao executar deactivateExpiredLicenses no startup: ${(err as Error)?.message}`);
    }

    this.interval = setInterval(async () => {
      try {
        await this.licenseService.deactivateExpiredLicenses();
      } catch (err) {
        this.logger.warn(`Falha ao executar deactivateExpiredLicenses: ${(err as Error)?.message}`);
      }
    }, intervalMs);

    // allow process to exit if nothing else is pending
    this.interval.unref?.();
    this.logger.log(`License expiration job agendado a cada ${intervalMs}ms`);
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }
}
