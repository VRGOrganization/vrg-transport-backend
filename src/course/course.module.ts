import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../common/common.module';
import { UniversityModule } from '../university/university.module';
import { COURSE_REPOSITORY } from './interface/repository.interface';
import { CourseRepository } from './repository/course.repository';
import { Course, CourseSchema } from './schema/course.schema';
import { CourseController } from './course.controller';
import { CourseService } from './course.service';

@Module({
  imports: [
    CommonModule,
    UniversityModule,
    MongooseModule.forFeature([{ name: Course.name, schema: CourseSchema }]),
  ],
  controllers: [CourseController],
  providers: [
    CourseService,
    {
      provide: COURSE_REPOSITORY,
      useClass: CourseRepository,
    },
  ],
  exports: [CourseService],
})
export class CourseModule {}