import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
  Req,
  Query,
} from '@nestjs/common';
import type { Request } from 'express';
import { ImagesService } from './image.service';
import { CreateImageDto, UpdateImageDto, UploadMyDocumentDto } from './dto/image.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/interfaces/user-roles.enum';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MongoObjectIdPipe } from '../common/pipes/mongo-object-id.pipe';

@ApiTags('Images')
@Controller('image')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post()
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create image', description: 'Creates a new image.' })
  @ApiParam({ name: 'id', description: 'Image ID (MongoDB ObjectId)', example: '6650a1f2c3d4e5f6a7b8c9d0' })
  @ApiResponse({ status: 200, description: 'Image created successfully.' })
  @ApiResponse({ status: 401, description: 'N?o autenticado.' })
  @ApiResponse({ status: 403, description: 'Permiss?o insuficiente.' })
  @ApiResponse({ status: 404, description: 'Image not found.' })
  create(@Body() dto: CreateImageDto) {
    return this.imagesService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Listar imagens', description: 'Retorna todas as imagens cadastradas.' })
  @ApiResponse({ status: 200, description: 'List of images.' })
  @ApiResponse({ status: 401, description: 'N?o autenticado.' })
  @ApiResponse({ status: 403, description: 'Permiss?o insuficiente.' })
  findAll(
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const page = Math.max(1, Number.parseInt(pageRaw ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(limitRaw ?? '20', 10) || 20));
    return this.imagesService.findAllPaginated(page, limit);
  }

  @Post('me')
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Enviar minha imagem', description: 'O estudante envia sua pr?pria imagem (foto de perfil ou documento).' })
  @ApiResponse({ status: 201, description: 'Image created successfully.' })
  @ApiResponse({ status: 409, description: 'Image of this type already exists.' })
  createMyImage(
    @Req() req: Request,
    @Body() dto: Omit<CreateImageDto, 'studentId'>,
  ) {
    return this.imagesService.create({
      ...dto,
      studentId: req.sessionPayload!.userId,
    } as CreateImageDto);
  }

  @Get('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Minhas imagens', description: 'Retorna todas as imagens do estudante autenticado.' })
  @ApiResponse({ status: 200, description: 'Imagens do estudante autenticado.' })
  @ApiResponse({ status: 401, description: 'N?o autenticado.' })
  @ApiResponse({ status: 403, description: 'Permiss?o insuficiente (requer papel STUDENT).' })
  findMyImages(@Req() req: Request) {
    return this.imagesService.findByStudentId(req.sessionPayload!.userId);
  }

  @Get('me/profile')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Minha foto de perfil', description: 'Retorna a foto de perfil do estudante autenticado.' })
  @ApiResponse({ status: 200, description: 'Foto de perfil do estudante autenticado.' })
  @ApiResponse({ status: 401, description: 'N?o autenticado.' })
  @ApiResponse({ status: 403, description: 'Permiss?o insuficiente (requer papel STUDENT).' })
  @ApiResponse({ status: 404, description: 'Profile photo not found.' })
  findMyProfilePhoto(@Req() req: Request) {
    return this.imagesService.findProfilePhoto(req.sessionPayload!.userId);
  }

  @Get('student/me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Minhas imagens (atalho do estudante)', description: 'Retorna todas as imagens do estudante autenticado.' })
  @ApiResponse({ status: 200, description: 'Imagens do estudante autenticado.' })
  @ApiResponse({ status: 401, description: 'N?o autenticado.' })
  @ApiResponse({ status: 403, description: 'Permiss?o insuficiente (requer papel STUDENT).' })
  findMyImagesByStudentAlias(@Req() req: Request) {
    return this.imagesService
      .findByStudentId(req.sessionPayload!.userId)
      .then((images) =>
        images.map((image) => ({
          _id: (image as any)._id,
          studentId: image.studentId,
          photoType: image.photoType,
          active: image.active,
          hasFile: Boolean(image.photo3x4 || image.documentImage || image.studentCard),
        })),
      );
  }

  @Get('history/student/:studentId')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Hist?rico de imagens por estudante', description: 'Retorna vers?es anteriores arquivadas de imagens de um estudante, ordenadas pela substitui??o mais recente.' })
  @ApiParam({ name: 'studentId', description: 'Student ID (MongoDB ObjectId)', example: '6650a1f2c3d4e5f6a7b8c9d0' })
  @ApiResponse({ status: 200, description: 'Image history for the student.' })
  @ApiResponse({ status: 401, description: 'N?o autenticado.' })
  @ApiResponse({ status: 403, description: 'Permiss?o insuficiente.' })
  findImageHistoryByStudentId(
    @Param('studentId', MongoObjectIdPipe) studentId: string,
  ) {
    return this.imagesService.findHistoryByStudentId(studentId);
  }

  @Get('student/:studentId')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Imagens por estudante', description: 'Retorna todas as imagens de um estudante espec?fico. Requer papel ADMIN ou EMPLOYEE.' })
  @ApiParam({ name: 'studentId', description: 'Student ID (MongoDB ObjectId)', example: '6650a1f2c3d4e5f6a7b8c9d0' })
  @ApiResponse({ status: 200, description: 'Images for the student.' })
  @ApiResponse({ status: 401, description: 'N?o autenticado.' })
  @ApiResponse({ status: 403, description: 'Permiss?o insuficiente.' })
  @ApiResponse({ status: 404, description: 'Student not found.' })
  findByStudentId(@Param('studentId', MongoObjectIdPipe) studentId: string) {
    return this.imagesService.findByStudentId(studentId);
  }

  @Get(':id/file')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Buscar meu arquivo de imagem por ID', description: 'Retorna o payload completo em base64 de um documento de imagem do estudante autenticado.' })
  @ApiParam({ name: 'id', description: 'Image ID (MongoDB ObjectId)', example: '6650a1f2c3d4e5f6a7b8c9d0' })
  @ApiResponse({ status: 200, description: 'Image file payload.' })
  @ApiResponse({ status: 401, description: 'N?o autenticado.' })
  @ApiResponse({ status: 403, description: 'Permiss?o insuficiente ou a imagem n?o pertence ao estudante autenticado.' })
  @ApiResponse({ status: 404, description: 'Image not found.' })
  async findMyImageFileById(
    @Param('id', MongoObjectIdPipe) id: string,
    @Req() req: Request,
  ) {
    return this.imagesService.findMyImageFileById(
      id,
      req.sessionPayload!.userId,
      req.sessionPayload!.userType,
      req.headers['user-agent'],
      req.ip,
    );
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Buscar imagem por ID', description: 'Retorna os dados de uma imagem espec?fica.' })
  @ApiParam({ name: 'id', description: 'Image ID (MongoDB ObjectId)', example: '6650a1f2c3d4e5f6a7b8c9d0' })
  @ApiResponse({ status: 200, description: 'Image data.' })
  @ApiResponse({ status: 401, description: 'N?o autenticado.' })
  @ApiResponse({ status: 403, description: 'Permiss?o insuficiente.' })
  @ApiResponse({ status: 404, description: 'Image not found.' })
  findOne(@Param('id', MongoObjectIdPipe) id: string) {
    return this.imagesService.findOne(id);
  }

  @Patch('student/:studentId/profile')
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Atualizar foto de perfil do estudante', description: 'Atualiza a foto de perfil de um estudante espec?fico por ID. Requer papel EMPLOYEE ou ADMIN.' })
  @ApiParam({ name: 'studentId', description: 'Student ID (MongoDB ObjectId)', example: '6650a1f2c3d4e5f6a7b8c9d0' })
  @ApiBody({ type: UpdateImageDto })
  @ApiResponse({ status: 200, description: 'Profile photo updated successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid data.' })
  @ApiResponse({ status: 401, description: 'N?o autenticado.' })
  @ApiResponse({ status: 403, description: 'Permiss?o insuficiente.' })
  @ApiResponse({ status: 404, description: 'Student or image not found.' })
  updateByStudentId(
    @Param('studentId', MongoObjectIdPipe) studentId: string,
    @Body() dto: UpdateImageDto,
  ) {
    return this.imagesService.updateByStudentId(studentId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Atualizar imagem por ID', description: 'Updates the data of a specific image. Requires EMPLOYEE or ADMIN role.' })
  @ApiParam({ name: 'id', description: 'Image ID (MongoDB ObjectId)', example: '6650a1f2c3d4e5f6a7b8c9d0' })
  @ApiBody({ type: UpdateImageDto })
  @ApiResponse({ status: 200, description: 'Image updated successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid data.' })
  @ApiResponse({ status: 401, description: 'N?o autenticado.' })
  @ApiResponse({ status: 403, description: 'Permiss?o insuficiente.' })
  @ApiResponse({ status: 404, description: 'Image not found.' })
  update(@Param('id', MongoObjectIdPipe) id: string, @Body() dto: UpdateImageDto) {
    return this.imagesService.update(id, dto);
  }

  @Delete('student/:studentId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove images of a student', description: 'Removes all images of a specific student. Exclusive for ADMIN.' })
  @ApiParam({ name: 'studentId', description: 'Student ID (MongoDB ObjectId)', example: '6650a1f2c3d4e5f6a7b8c9d0' })
  @ApiResponse({ status: 200, description: 'Images of the student removed successfully.' })
  @ApiResponse({ status: 401, description: 'N?o autenticado.' })
  @ApiResponse({ status: 403, description: 'Permiss?o insuficiente (requer papel ADMIN).' })
  @ApiResponse({ status: 404, description: 'Student not found.' })
  removeByStudentId(@Param('studentId', MongoObjectIdPipe) studentId: string) {
    return this.imagesService.removeByStudentId(studentId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove image by ID', description: 'Removes an image by its ID. Exclusive for ADMIN.' })
  @ApiParam({ name: 'id', description: 'Image ID (MongoDB ObjectId)', example: '6650a1f2c3d4e5f6a7b8c9d0' })
  @ApiResponse({ status: 200, description: 'Image removed successfully.' })
  @ApiResponse({ status: 401, description: 'N?o autenticado.' })
  @ApiResponse({ status: 403, description: 'Permiss?o insuficiente (requer papel ADMIN).' })
  @ApiResponse({ status: 404, description: 'Image not found.' })
  remove(@Param('id', MongoObjectIdPipe) id: string) {
    return this.imagesService.remove(id);
  }
}