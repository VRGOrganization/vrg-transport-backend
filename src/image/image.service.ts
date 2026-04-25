import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { Image } from './schema/image.schema';
import { CreateImageDto, UpdateImageDto, UploadMyDocumentDto } from './dto/image.dto';
import { PhotoType } from './types/photoType.enum';
import { IMAGE_REPOSITORY } from './interface/repository.interface';
import type { IImageRepository } from './interface/repository.interface';
import { ImageHistory, ImageHistoryDocument } from './schema/image-history.schema';
import { AuditLogService } from '../common/audit/audit-log.service';
import type { UserType } from '../auth/session/session.schema';

@Injectable()
export class ImagesService {
  constructor(
    @Inject(IMAGE_REPOSITORY)
    private readonly imageRepository: IImageRepository,
    private readonly auditLog: AuditLogService,
    @InjectModel(ImageHistory.name, 'images')
    private readonly imageHistoryModel: Model<ImageHistoryDocument>,
  ) {}

  async create(dto: CreateImageDto, session?: ClientSession): Promise<Image> {
    const existing = await this.imageRepository.findOneByStudentAndPhotoType(
      dto.studentId,
      dto.photoType,
    );

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

    const isDocumentType =
      dto.photoType === PhotoType.EnrollmentProof ||
      dto.photoType === PhotoType.CourseSchedule ||
      dto.photoType === PhotoType.GovernmentId ||
      dto.photoType === PhotoType.ProofOfResidence;

    if (isDocumentType && !dto.documentImage) {
      throw new BadRequestException(
        `documentImage é obrigatório para o tipo ${dto.photoType}`,
      );
    }

    if (dto.photo3x4) {
      this.assertValidImageDataUrl(dto.photo3x4);
    }
    if (dto.documentImage) {
      this.assertValidDocumentDataUrl(dto.documentImage);
    }

    return this.imageRepository.create({
      studentId: dto.studentId,
      photoType: dto.photoType,
      photo3x4: dto.photo3x4 ?? null,
      documentImage: dto.documentImage ?? null,
      studentCard: null,
    }, session);
  }

  async createForStudent(studentId: string, dto: UploadMyDocumentDto): Promise<Image> {
    return this.create({ studentId, photoType: dto.photoType, photo3x4: dto.photo3x4 });
  }

  async findAll(): Promise<Image[]> {
    return this.imageRepository.findAllActive();
  }

  async findAllPaginated(
    page: number,
    limit: number,
  ): Promise<{ data: Image[]; total: number; page: number; limit: number }> {
    return this.imageRepository.findAllPaginatedActive(page, limit);
  }

  async findOne(id: string): Promise<Image>;
  async findOne(filter: Partial<Image> & { _id?: string }): Promise<Image | null>;
  async findOne(idOrFilter: string | (Partial<Image> & { _id?: string })): Promise<Image | null> {
    if (typeof idOrFilter === 'string') {
      const image = await this.imageRepository.findById(idOrFilter);
      if (!image) throw new NotFoundException(`Imagem ${idOrFilter} não encontrada`);
      return image;
    }

    return this.imageRepository.findOneByFilter(idOrFilter);
  }

  async archiveToHistory(imageId: string): Promise<void> {
    const image = await this.imageRepository.findById(imageId);

    if (!image) {
      throw new NotFoundException(`Imagem ${imageId} não encontrada`);
    }

    await this.imageRepository.archiveImageToHistory(image);
  }

  async findByStudentId(studentId: string): Promise<Image[]> {
    return this.imageRepository.findByStudentIdActive(studentId);
  }

  async findHistoryByStudentId(studentId: string): Promise<ImageHistory[]> {
    return this.imageHistoryModel
      .find({ studentId })
      .sort({ replacedAt: -1 })
      .lean()
      .exec();
  }

  async findMyImageFileById(
    imageId: string,
    studentId: string,
    userType: UserType,
    userAgent?: string | string[],
    ipAddress?: string,
  ): Promise<{
    _id: unknown;
    studentId: string;
    photoType: PhotoType;
    active: boolean;
    photo3x4: string | null;
    documentImage: string | null;
    studentCard: string | null;
  }> {
    const image = await this.findOne({
      _id: imageId,
      studentId,
      active: true,
    });

    if (!image) {
      throw new ForbiddenException('Acesso negado');
    }

    await this.auditLog.record({
      action: 'image.access',
      outcome: 'success',
      actor: {
        id: studentId,
        role: userType,
      },
      target: { imageId, photoType: image.photoType },
      metadata: {
        userAgent: typeof userAgent === 'string' ? userAgent : undefined,
        ip: ipAddress,
      },
    });

    return {
      _id: (image as any)._id,
      studentId: image.studentId,
      photoType: image.photoType,
      active: image.active,
      photo3x4: image.photo3x4,
      documentImage: image.documentImage,
      studentCard: image.studentCard,
    };
  }

  async findProfilePhoto(studentId: string): Promise<Image> {
    const image = await this.imageRepository.findProfilePhotoActive(studentId);

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

  async update(id: string, dto: UpdateImageDto, session?: ClientSession): Promise<Image> {
    const update = this.pickDefined(dto);

    if (update.photo3x4) {
      this.assertValidImageDataUrl(update.photo3x4);
    }
    if (update.documentImage) {
      this.assertValidDocumentDataUrl(update.documentImage);
    }

    const image = await this.imageRepository.updateById(
      id,
      update as Partial<Image>,
      session,
    );

    if (!image) throw new NotFoundException(`Imagem ${id} não encontrada`);
    return image;
  }

  async updateByStudentId(
    studentId: string,
    dto: UpdateImageDto,
    session?: ClientSession,
  ): Promise<Image> {
    const update = this.pickDefined(dto);
    if (update.photo3x4) {
      this.assertValidImageDataUrl(update.photo3x4);
    }
    if (update.documentImage) {
      this.assertValidDocumentDataUrl(update.documentImage);
    }

    const image = await this.imageRepository.updateProfilePhotoByStudentId(
      studentId,
      update as Partial<Image>,
      session,
    );

    if (!image) {
      throw new NotFoundException(
        `Foto de perfil não encontrada para o student ${studentId}`,
      );
    }

    return image;
  }

  async remove(id: string): Promise<{ message: string }> {
    const result = await this.imageRepository.softDeleteById(id);

    if (!result) throw new NotFoundException(`Imagem ${id} não encontrada`);
    return { message: 'Imagem removida com sucesso' };
  }

  async removeByStudentId(studentId: string): Promise<{ message: string }> {
    const modifiedCount = await this.imageRepository.softDeleteByStudentId(studentId);

    if (modifiedCount === 0) {
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

  private assertValidDocumentDataUrl(dataUrl: string): void {
    const imageDataUrlRegex = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/;
    const pdfDataUrlRegex = /^data:application\/pdf;base64,(.+)$/;

    if (imageDataUrlRegex.test(dataUrl)) {
      this.assertValidImageDataUrl(dataUrl);
      return;
    }

    const pdfMatch = pdfDataUrlRegex.exec(dataUrl);
    if (!pdfMatch) {
      throw new BadRequestException('Formato de documento inválido');
    }

    const buffer = Buffer.from(pdfMatch[1], 'base64');
    if (buffer.length < 5) {
      throw new BadRequestException('Documento PDF inválido');
    }

    const isPdf = buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    if (!isPdf) {
      throw new BadRequestException(
        'Conteúdo do documento não confere com o tipo informado',
      );
    }
  }
}
