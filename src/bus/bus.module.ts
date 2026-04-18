import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../common/common.module';
import { EnrollmentPeriodModule } from '../enrollment-period/enrollment-period.module';
import { UniversityModule } from '../university/university.module';
import { BUS_REPOSITORY } from './interface/repository.interface';
import { BusRepository } from './repository/bus.repository';
import { Bus, BusSchema } from './schema/bus.schema';
import { BusController } from './bus.controller';
import { BusService } from './bus.service';

@Module({
  imports: [
    CommonModule,
    UniversityModule,
    forwardRef(() => EnrollmentPeriodModule),
    MongooseModule.forFeature([{ name: Bus.name, schema: BusSchema }]),
  ],
  controllers: [BusController],
  providers: [
    BusService,
    {
      provide: BUS_REPOSITORY,
      useClass: BusRepository,
    },
  ],
  exports: [BusService],
})
export class BusModule {}