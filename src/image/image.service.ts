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

    if (dto.photo3x4) {
      this.assertValidImageDataUrl(dto.photo3x4);
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


  private pickDefined(dto: UpdateImageDto): Partial<UpdateImageDto> {
    const update = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );

    if (Object.keys(update).length === 0) {
      throw new BadRequestException(
        'Envie ao menos um campo para atualização',
      );
    }

    return update as Partial<UpdateImageDto>;
  }

  async update(id: string, dto: UpdateImageDto): Promise<Image> {
    const update = this.pickDefined(dto);

    if (update.photo3x4) {
      this.assertValidImageDataUrl(update.photo3x4);
    }

    const image = await this.imageModel
      .findByIdAndUpdate(
        id,
        { $set: update },
        {
          new: true,
          runValidators: true,
          context: 'query',
        },
      )
      .exec();

    if (!image) throw new NotFoundException(`Imagem ${id} não encontrada`);
    return image;
  }

  async updateByStudentId(
    studentId: string,
    dto: UpdateImageDto,
  ): Promise<Image> {
    const update = this.pickDefined(dto);
    if (update.photo3x4) {
      this.assertValidImageDataUrl(update.photo3x4);
    }

    const image = await this.imageModel
      .findOneAndUpdate(
        { studentId, photoType: PhotoType.ProfilePhoto, active: true },
        { $set: update },
        {
          new: true,
          runValidators: true,
          context: 'query',
        },
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
      .findByIdAndUpdate(
        id,
        { $set: { active: false } },
        { new: true, runValidators: true },
      )
      .exec();

    if (!result) throw new NotFoundException(`Imagem ${id} não encontrada`);
    return { message: 'Imagem removida com sucesso' };
  }

  async removeByStudentId(studentId: string): Promise<{ message: string }> {
    const result = await this.imageModel
      .updateMany(
        { studentId },
        { $set: { active: false } },
      )
      .exec();

    if (result.modifiedCount === 0) {
      throw new NotFoundException(
        `Nenhuma imagem encontrada para o student ${studentId}`,
      );
    }

    return { message: 'Imagens do student removidas com sucesso' };
  }

  private assertValidImageDataUrl(dataUrl: string): void {
    const match = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/.exec(dataUrl);
    if (!match) {
      throw new BadRequestException('Formato de imagem inválido');
    }

    const mime = match[1].toLowerCase();
    const buffer = Buffer.from(match[2], 'base64');

    if (buffer.length === 0) {
      throw new BadRequestException('Imagem inválida');
    }

    const isJpeg =
      buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

    const isPng =
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

    const isWebp =
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP';

    const valid =
      mime === 'jpeg' || mime === 'jpg'
        ? isJpeg
        : mime === 'png'
          ? isPng
          : mime === 'webp'
            ? isWebp
            : false;

    if (!valid) {
      throw new BadRequestException(
        'Conteúdo da imagem não confere com o tipo informado',
      );
    }
  }
}
