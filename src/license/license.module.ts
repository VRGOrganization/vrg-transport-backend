import { Module } from '@nestjs/common';
import { LicenseService } from './license.service';
import { LicenseController } from './license.controller';
import { StudentModule } from 'src/student/student.module';
import { MongooseModule } from '@nestjs/mongoose';
import { License, LicenseSchema } from './schemas/license.schema';

@Module({
  controllers: [LicenseController],
  providers: [LicenseService],
  imports: [
    StudentModule,
    MongooseModule.forFeature([
      { name: License.name, schema: LicenseSchema }
    ])
  ]
})
export class LicenseModule {}
