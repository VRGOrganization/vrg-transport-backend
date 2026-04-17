import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bus, BusDocument } from '../schema/bus.schema';
import { IBusRepository } from '../interface/repository.interface';

@Injectable()
export class BusRepository implements IBusRepository<Bus> {
  constructor(
    @InjectModel(Bus.name)
    private readonly busModel: Model<BusDocument>,
  ) {}

  async create(data: Partial<Bus>): Promise<Bus> {
    const bus = new this.busModel(data);
    return bus.save();
  }

  async findAll(): Promise<Bus[]> {
    return this.busModel
      .find({ active: true })
      .populate('universityIds', 'name acronym address')
      .exec();
  }

  async findAllInactive(): Promise<Bus[]> {
    return this.busModel
      .find({ active: false })
      .populate('universityIds', 'name acronym address')
      .exec();
  }

  async findById(id: string): Promise<Bus | null> {
    return this.busModel
      .findById(id)
      .populate('universityIds', 'name acronym address')
      .exec();
  }

  async findByIdentifier(identifier: string): Promise<Bus | null> {
    return this.busModel.findOne({ identifier: identifier.trim() }).exec();
  }

  async update(id: string, data: Partial<Bus>): Promise<Bus | null> {
    return this.busModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .populate('universityIds', 'name acronym address')
      .exec();
  }

  async addUniversity(busId: string, universityId: string): Promise<Bus | null> {
    return this.busModel
      .findByIdAndUpdate(
        busId,
        { $addToSet: { universityIds: new Types.ObjectId(universityId) } },
        { new: true },
      )
      .populate('universityIds', 'name acronym address')
      .exec();
  }

  async removeUniversity(busId: string, universityId: string): Promise<Bus | null> {
    return this.busModel
      .findByIdAndUpdate(
        busId,
        { $pull: { universityIds: new Types.ObjectId(universityId) } },
        { new: true },
      )
      .populate('universityIds', 'name acronym address')
      .exec();
  }

  async deactivate(id: string): Promise<boolean> {
    const result = await this.busModel
      .findByIdAndUpdate(id, { $set: { active: false } }, { new: true })
      .exec();
    return !!result;
  }
}