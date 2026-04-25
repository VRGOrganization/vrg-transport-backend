import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../common/common.module';
import { UNIVERSITY_REPOSITORY } from './interface/repository.interface';
import { UniversityRepository } from './repository/university.repository';
import { University, UniversitySchema } from './schema/university.schema';
import { UniversityController } from './university.controller';
import { UniversityService } from './university.service';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([
      { name: University.name, schema: UniversitySchema },
    ]),
  ],
  controllers: [UniversityController],
  providers: [
    UniversityService,
    {
      provide: UNIVERSITY_REPOSITORY,
      useClass: UniversityRepository,
    },
  ],
  exports: [UniversityService],
})
export class UniversityModule {}