import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
import { BusRoute, BusRouteDocument } from '../schema/bus-route.schema';
import { IBusRouteRepository } from '../interface/repository.interface';

@Injectable()
export class BusRouteRepository implements IBusRouteRepository<BusRoute> {
  constructor(
    @InjectModel(BusRoute.name)
    private readonly busRouteModel: Model<BusRouteDocument>,
  ) {}

  async create(data: Partial<BusRoute>): Promise<BusRoute> {
    const route = new this.busRouteModel(data);
    return route.save();
  }

  async findAll(): Promise<BusRoute[]> {
    return this.busRouteModel.find({ active: true }).exec();
  }

  async findAllInactive(): Promise<BusRoute[]> {
    return this.busRouteModel.find({ active: false }).exec();
  }

  async findById(id: string): Promise<BusRoute | null> {
    return this.busRouteModel.findById(id).exec();
  }

  async findByLineNumberNormalized(
    lineNumberNormalized: string,
  ): Promise<BusRoute | null> {
    return this.busRouteModel
      .findOne({
        active: true,
        lineNumberNormalized: lineNumberNormalized.trim().toLowerCase(),
      })
      .exec();
  }

  async update(
    id: string,
    data: Partial<BusRoute>,
    session?: ClientSession,
  ): Promise<BusRoute | null> {
    return this.busRouteModel
      .findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after', session })
      .exec();
  }

  async deactivate(id: string): Promise<boolean> {
    const result = await this.busRouteModel
      .findByIdAndUpdate(id, { $set: { active: false } }, { returnDocument: 'after' })
      .exec();
    return !!result;
  }
}
