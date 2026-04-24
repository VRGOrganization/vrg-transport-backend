import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../common/common.module';
import { AuditModule } from '../common/audit/audit.module';
import { BUS_ROUTE_REPOSITORY } from './interface/repository.interface';
import { BusRouteController } from './bus-route.controller';
import { BusRouteService } from './bus-route.service';
import { BusRouteRepository } from './repository/bus-route.repository';
import { BusRoute, BusRouteSchema } from './schema/bus-route.schema';

@Module({
  imports: [
    CommonModule,
    AuditModule,
    MongooseModule.forFeature([{ name: BusRoute.name, schema: BusRouteSchema }]),
  ],
  controllers: [BusRouteController],
  providers: [
    BusRouteService,
    {
      provide: BUS_ROUTE_REPOSITORY,
      useClass: BusRouteRepository,
    },
  ],
  exports: [BusRouteService],
})
export class BusRouteModule {}
