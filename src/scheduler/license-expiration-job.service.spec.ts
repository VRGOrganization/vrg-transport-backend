import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ConfigService } from '@nestjs/config';
import { LicenseExpirationJobService } from './license-expiration-job.service';
import { LicenseService } from '../license/license.service';
import { AuditLogService } from '../common/audit/audit-log.service';

const mockLicenseService = {
  deactivateExpiredLicenses: jest.fn(),
};

const mockAuditLog = {
  record: jest.fn(),
};

const mockSchedulerRegistry = {
  addCronJob: jest.fn(),
  deleteCronJob: jest.fn(),
};

describe('LicenseExpirationJobService', () => {
  let service: LicenseExpirationJobService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicenseExpirationJobService,
        { provide: LicenseService, useValue: mockLicenseService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              const values: Record<string, unknown> = {
                LICENSE_EXPIRATION_JOB_ENABLED: 'true',
                LICENSE_EXPIRATION_CRON: '0 0 * * * *',
              };
              return values[key] ?? defaultValue;
            }),
          },
        },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: SchedulerRegistry, useValue: mockSchedulerRegistry },
      ],
    }).compile();

    service = module.get(LicenseExpirationJobService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('executa no startup e registra o cron quando habilitado', async () => {
    const cronStart = jest.fn();
    const cronStop = jest.fn();
    const cronJob = { start: cronStart, stop: cronStop } as any;
    jest.spyOn(CronJob, 'from').mockReturnValue(cronJob);
    mockLicenseService.deactivateExpiredLicenses.mockResolvedValue(3);
    mockAuditLog.record.mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(mockSchedulerRegistry.addCronJob).toHaveBeenCalledWith(
      'license-expiration-job',
      cronJob,
    );
    expect(cronStart).toHaveBeenCalled();
    expect(mockLicenseService.deactivateExpiredLicenses).toHaveBeenCalled();
    expect(mockAuditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'license_expiration_job.run',
        outcome: 'success',
        metadata: expect.objectContaining({
          deactivatedCount: 3,
          trigger: 'startup',
        }),
      }),
    );
  });

  it('nao registra cron quando desabilitado', async () => {
    const disabledModule: TestingModule = await Test.createTestingModule({
      providers: [
        LicenseExpirationJobService,
        { provide: LicenseService, useValue: mockLicenseService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              const values: Record<string, unknown> = {
                LICENSE_EXPIRATION_JOB_ENABLED: 'false',
              };
              return values[key] ?? defaultValue;
            }),
          },
        },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: SchedulerRegistry, useValue: mockSchedulerRegistry },
      ],
    }).compile();

    const disabledService = disabledModule.get(LicenseExpirationJobService);
    await disabledService.onModuleInit();

    expect(mockSchedulerRegistry.addCronJob).not.toHaveBeenCalled();
    expect(mockLicenseService.deactivateExpiredLicenses).not.toHaveBeenCalled();
  });

  it('retorna skipped quando ja existe execucao ativa', async () => {
    (service as any).running = true;

    const result = await service.runExpirationCycle('manual');

    expect(result).toEqual({ status: 'skipped', deactivatedCount: 0 });
    expect(mockLicenseService.deactivateExpiredLicenses).not.toHaveBeenCalled();
  });

  it('trata erro sem derrubar o job', async () => {
    mockLicenseService.deactivateExpiredLicenses.mockRejectedValue(
      new Error('boom'),
    );
    mockAuditLog.record.mockResolvedValue(undefined);

    const result = await service.runExpirationCycle('manual');

    expect(result).toEqual({ status: 'failure', deactivatedCount: 0 });
    expect(mockAuditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'license_expiration_job.run',
        outcome: 'failure',
      }),
    );
  });
});
