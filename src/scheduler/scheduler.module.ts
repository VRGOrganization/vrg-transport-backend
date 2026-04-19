import { Module } from '@nestjs/common';
import { LicenseModule } from '../license/license.module';
import { LicenseExpirationJobService } from './license-expiration-job.service';

@Module({
  imports: [LicenseModule],
  providers: [LicenseExpirationJobService],
})
export class SchedulerModule {}
