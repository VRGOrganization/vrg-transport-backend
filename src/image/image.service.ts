import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Image, ImageDocument } from './image.schema';
import { CreateImageDto } from './create-image.dto';
import { UpdateImageDto } from './update-image.dto';

@Injectable()
export class ImagesService {
  constructor(
    @InjectModel(Image.name, 'images')
    private imageModel: Model<ImageDocument>,
  ) {}

  async create(createImageDto: CreateImageDto): Promise<Image> {
    const createdImage = new this.imageModel(createImageDto);
    return createdImage.save();
  }

  async findAll(): Promise<Image[]> {
    return this.imageModel.find().exec();
  }

  async findOne(id: string): Promise<Image | null> {
    return this.imageModel.findById(id).exec();
  }

  async findByStudentId(studentId: string): Promise<Image | null> {
    return this.imageModel.findOne({ studentId }).exec();
  }

  async update(
    id: string,
    updateImageDto: UpdateImageDto,
  ): Promise<Image | null> {
    return this.imageModel
      .findByIdAndUpdate(id, updateImageDto, { new: true })
      .exec();
  }

  async updateByStudentId(
    studentId: string,
    updateImageDto: UpdateImageDto,
  ): Promise<Image | null> {
    return this.imageModel
      .findOneAndUpdate({ studentId }, updateImageDto, { new: true })
      .exec();
  }

  async remove(id: string): Promise<Image | null> {
    return this.imageModel.findByIdAndDelete(id).exec();
  }

  async removeByStudentId(studentId: string): Promise<Image | null> {
    return this.imageModel.findOneAndDelete({ studentId }).exec();
  }
}
