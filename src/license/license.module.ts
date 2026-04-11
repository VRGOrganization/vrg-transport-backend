import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LicenseService } from './license.service';
import { LicenseController } from './license.controller';
import { LicenseRepository } from './repository/license.repository';
import { License, LicenseSchema } from './schemas/license.schema';
import { LICENSE_REPOSITORY } from './interfaces/repository.interface';
import { StudentModule } from 'src/student/student.module';
import { AuditModule } from 'src/common/audit/audit.module';
import { MailModule } from 'src/mail/mail.module';
import { LicenseRequestModule } from 'src/license-request/license-request.module';

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
    forwardRef(() => LicenseRequestModule),
    forwardRef(() => StudentModule),
    MongooseModule.forFeature([
      { name: License.name, schema: LicenseSchema },
    ]),
  ],
  exports: [LicenseService],
})
export class LicenseModule {}