import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../common/audit/audit.module';
import { BusModule } from '../bus/bus.module';
import { EnrollmentPeriodModule } from '../enrollment-period/enrollment-period.module';
import { LicenseModule } from '../license/license.module';
import { MailModule } from '../mail/mail.module';
import { StudentModule } from '../student/student.module';
import { StudentService } from '../student/student.service';
import { ImagesModule } from '../image/image.module';
import { LICENSE_REQUEST_REPOSITORY } from './interfaces/repository.interface';
import { LicenseRequestController } from './license-request.controller';
import { LicenseRequestService } from './license-request.service';
import { LicenseRequestRepository } from './repository/license-request.repository';
import {
  LicenseRequest,
  LicenseRequestSchema,
} from './schemas/license-request.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LicenseRequest.name, schema: LicenseRequestSchema },
    ]),
    // BusService used to resolve bus/university at request creation
    forwardRef(() => BusModule),
    forwardRef(() => LicenseModule),
    forwardRef(() => EnrollmentPeriodModule),
    forwardRef(() => StudentModule),
    ImagesModule,
    MailModule,
    AuditModule,
  ],
  controllers: [LicenseRequestController],
  providers: [
    LicenseRequestService,
    {
      provide: LICENSE_REQUEST_REPOSITORY,
      useClass: LicenseRequestRepository,
    },
  ],
  exports: [LicenseRequestService, LICENSE_REQUEST_REPOSITORY],
})
export class LicenseRequestModule {}
