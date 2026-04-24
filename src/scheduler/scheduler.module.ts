import { Module } from '@nestjs/common';
import { AuditModule } from '../common/audit/audit.module';
import { LicenseModule } from '../license/license.module';
import { LicenseExpirationJobService } from './license-expiration-job.service';

@Module({
  imports: [LicenseModule, AuditModule],
  providers: [LicenseExpirationJobService],
})
export class SchedulerModule {}
