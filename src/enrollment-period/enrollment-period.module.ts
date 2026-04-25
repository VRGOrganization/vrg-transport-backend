import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../common/audit/audit.module';
import { LicenseModule } from '../license/license.module';
import { LicenseRequestModule } from '../license-request/license-request.module';
import { MailModule } from '../mail/mail.module';
import { StudentModule } from '../student/student.module';
import { BusModule } from '../bus/bus.module';
import { EnrollmentPeriodController } from './enrollment-period.controller';
import { EnrollmentPeriodService } from './enrollment-period.service';
import { ENROLLMENT_PERIOD_REPOSITORY } from './interfaces/repository.interface';
import { EnrollmentPeriodRepository } from './repository/enrollment-period.repository';
import {
  EnrollmentPeriod,
  EnrollmentPeriodSchema,
} from './schemas/enrollment-period.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EnrollmentPeriod.name, schema: EnrollmentPeriodSchema },
    ]),
    forwardRef(() => LicenseModule),
    forwardRef(() => LicenseRequestModule),
    forwardRef(() => StudentModule),
    forwardRef(() => BusModule),
    MailModule,
    AuditModule,
  ],
  controllers: [EnrollmentPeriodController],
  providers: [
    EnrollmentPeriodService,
    {
      provide: ENROLLMENT_PERIOD_REPOSITORY,
      useClass: EnrollmentPeriodRepository,
    },
  ],
  exports: [EnrollmentPeriodService],
})
export class EnrollmentPeriodModule {}
