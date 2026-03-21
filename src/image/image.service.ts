import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Image, ImageDocument } from './schema/image.schema';
import { CreateImageDto, UpdateImageDto } from './dto/image.dto';
import { PhotoType } from './types/photoType.enum';

@Injectable()
export class ImagesService {
  constructor(
    @InjectModel(Image.name, 'images')
    private readonly imageModel: Model<ImageDocument>,
  ) {}

  async create(dto: CreateImageDto): Promise<Image> {
    // Não permite duplicata de (studentId + photoType)
    const existing = await this.imageModel.findOne({
      studentId: dto.studentId,
      photoType: dto.photoType,
    });

    if (existing) {
      throw new ConflictException(
        `Já existe uma imagem do tipo "${dto.photoType}" para este student`,
      );
    }

    if (dto.photoType === PhotoType.ProfilePhoto && !dto.photo3x4) {
      throw new BadRequestException(
        'photo3x4 é obrigatório para o tipo ProfilePhoto',
      );
    }

    const image = new this.imageModel({
      studentId: dto.studentId,
      photoType: dto.photoType,
      photo3x4: dto.photo3x4 ?? null,
      studentCard: null,
    });

    return image.save();
  }

  async findAll(): Promise<Image[]> {
    return this.imageModel.find({ active: true }).exec();
  }

  async findOne(id: string): Promise<Image> {
    const image = await this.imageModel.findById(id).exec();
    if (!image) throw new NotFoundException(`Imagem ${id} não encontrada`);
    return image;
  }

  async findByStudentId(studentId: string): Promise<Image[]> {
    return this.imageModel.find({ studentId, active: true }).exec();
  }

  async findProfilePhoto(studentId: string): Promise<Image> {
    const image = await this.imageModel
      .findOne({ studentId, photoType: PhotoType.ProfilePhoto, active: true })
      .exec();

    if (!image) {
      throw new NotFoundException(
        `Foto de perfil não encontrada para o student ${studentId}`,
      );
    }

    return image;
  }

  async update(id: string, dto: UpdateImageDto): Promise<Image> {
    const image = await this.imageModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();

    if (!image) throw new NotFoundException(`Imagem ${id} não encontrada`);
    return image;
  }

  async updateByStudentId(studentId: string, dto: UpdateImageDto): Promise<Image> {
    const image = await this.imageModel
      .findOneAndUpdate(
        { studentId, photoType: PhotoType.ProfilePhoto, active: true },
        dto,
        { new: true },
      )
      .exec();

    if (!image) {
      throw new NotFoundException(
        `Foto de perfil não encontrada para o student ${studentId}`,
      );
    }

    return image;
  }

  async remove(id: string): Promise<{ message: string }> {
    const result = await this.imageModel
      .findByIdAndUpdate(id, { active: false }, { new: true })
      .exec();

    if (!result) throw new NotFoundException(`Imagem ${id} não encontrada`);
    return { message: 'Imagem removida com sucesso' };
  }

  async removeByStudentId(studentId: string): Promise<{ message: string }> {
    const result = await this.imageModel
      .updateMany({ studentId }, { active: false })
      .exec();

    if (result.modifiedCount === 0) {
      throw new NotFoundException(
        `Nenhuma imagem encontrada para o student ${studentId}`,
      );
    }

    return { message: 'Imagens do student removidas com sucesso' };
  }
}