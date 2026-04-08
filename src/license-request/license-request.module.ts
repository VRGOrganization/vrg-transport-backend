import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from 'src/common/audit/audit.module';
import { LicenseModule } from 'src/license/license.module';
import { MailModule } from 'src/mail/mail.module';
import { StudentModule } from 'src/student/student.module';
import { ImagesModule } from 'src/image/image.module';
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
    forwardRef(() => LicenseModule),
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
