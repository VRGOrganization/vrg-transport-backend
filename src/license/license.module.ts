import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LicenseService } from './license.service';
import { LicenseController } from './license.controller';
import { LicenseRepository } from './repository/license.repository';
import { License, LicenseSchema } from './schemas/license.schema';
import { LICENSE_REPOSITORY } from './interfaces/repository.interface';
import { AuditModule } from '../common/audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { LicenseRequestModule } from '../license-request/license-request.module';
import { StudentModule } from '../student/student.module';

@Module({
  controllers: [LicenseController],
  providers: [
    LicenseService,
    {
      provide: LICENSE_REPOSITORY,
      useClass: LicenseRepository,
    },
  ],
  imports: [
    AuditModule,
    MailModule,
    forwardRef(() => StudentModule),
    forwardRef(() => LicenseRequestModule),
    MongooseModule.forFeature([
      { name: License.name, schema: LicenseSchema },
    ]),
  ],
  exports: [LicenseService],
})
export class LicenseModule {}
