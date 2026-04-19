import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Course, CourseDocument } from '../schema/course.schema';
import { ICourseRepository } from '../interface/repository.interface';

@Injectable()
export class CourseRepository implements ICourseRepository<Course> {
  constructor(
    @InjectModel(Course.name)
    private readonly courseModel: Model<CourseDocument>,
  ) {}

  async create(data: Partial<Course>): Promise<Course> {
    const course = new this.courseModel(data);
    return course.save();
  }

  async findAll(): Promise<Course[]> {
    return this.courseModel
      .find({ active: { $ne: false } })
      .populate('universityId', 'name acronym')
      .exec();
  }

  async findAllInactive(): Promise<Course[]> {
    return this.courseModel
      .find({ active: false })
      .populate('universityId', 'name acronym')
      .exec();
  }

  async findById(id: string): Promise<Course | null> {
    return this.courseModel
      .findById(id)
      .populate('universityId', 'name acronym')
      .exec();
  }

  async findByUniversity(universityId: string): Promise<Course[]> {
    return this.courseModel
      .find({
        $or: [
          { universityId: new Types.ObjectId(universityId) },
          { universityId: universityId },
        ],
        active: { $ne: false },
      })
      .exec();
  }

  async findByNameAndUniversity(
    name: string,
    universityId: string,
  ): Promise<Course | null> {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.courseModel
      .findOne({
        name: { $regex: new RegExp(`^${escaped}$`, 'i') },
        $or: [
          { universityId: new Types.ObjectId(universityId) },
          { universityId: universityId },
        ],
        active: { $ne: false },
      })
      .exec();
  }

  async update(id: string, data: Partial<Course>): Promise<Course | null> {
    return this.courseModel
      .findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after' })
      .populate('universityId', 'name acronym')
      .exec();
  }

  async deactivate(id: string): Promise<boolean> {
    const result = await this.courseModel
      .findByIdAndUpdate(id, { $set: { active: false } }, { returnDocument: 'after' })
      .exec();
    return !!result;
  }
}
