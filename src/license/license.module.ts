import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LicenseService } from './license.service';
import { LicenseController } from './license.controller';
import { LicenseRepository } from './license.repository';
import { License, LicenseSchema } from './schemas/license.schema';
import { LICENSE_REPOSITORY } from './interfaces/repository.interface';
import { StudentModule } from 'src/student/student.module';

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
    StudentModule,
    MongooseModule.forFeature([
      { name: License.name, schema: LicenseSchema },
    ]),
  ],
})
export class LicenseModule {}