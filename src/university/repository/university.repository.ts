import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { University, UniversityDocument } from '../schema/university.schema';
import { IUniversityRepository } from '../interface/repository.interface';

@Injectable()
export class UniversityRepository implements IUniversityRepository<University> {
  constructor(
    @InjectModel(University.name)
    private readonly universityModel: Model<UniversityDocument>,
  ) {}

  async create(data: Partial<University>): Promise<University> {
    const university = new this.universityModel(data);
    return university.save();
  }

  async findAll(): Promise<University[]> {
    return this.universityModel.find({ active: true }).exec();
  }

  async findAllInactive(): Promise<University[]> {
    return this.universityModel.find({ active: false }).exec();
  }

  async findById(id: string): Promise<University | null> {
    return this.universityModel.findById(id).exec();
  }

  async findByAcronym(acronym: string): Promise<University | null> {
    return this.universityModel
      .findOne({ acronym: acronym.toUpperCase() })
      .exec();
  }

  async update(id: string, data: Partial<University>): Promise<University | null> {
    return this.universityModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .exec();
  }

  async deactivate(id: string): Promise<boolean> {
    const result = await this.universityModel
      .findByIdAndUpdate(id, { $set: { active: false } }, { new: true })
      .exec();
    return !!result;
  }
}