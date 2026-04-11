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
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Image not found.' })
  create(@Body() dto: CreateImageDto) {
    return this.imagesService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'List all images', description: 'Returns all registered images.' })
  @ApiResponse({ status: 200, description: 'List of images.' })
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
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
  @ApiOperation({ summary: 'Upload own image', description: 'Student uploads their own image (profile photo or document).' })
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
  @ApiOperation({ summary: 'My images', description: 'Returns all images for the authenticated student.' })
  @ApiResponse({ status: 200, description: 'Images for the authenticated student.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (requires STUDENT role).' })
  findMyImages(@Req() req: Request) {
    return this.imagesService.findByStudentId(req.sessionPayload!.userId);
  }

  @Get('me/profile')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'My profile photo', description: 'Returns the profile photo of the authenticated student.' })
  @ApiResponse({ status: 200, description: 'Profile photo of the authenticated student.' })
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (requires STUDENT role).' })
  @ApiResponse({ status: 404, description: 'Profile photo not found.' })
  findMyProfilePhoto(@Req() req: Request) {
    return this.imagesService.findProfilePhoto(req.sessionPayload!.userId);
  }

  @Get('student/me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'My images (student alias)', description: 'Returns all images for the authenticated student.' })
  @ApiResponse({ status: 200, description: 'Images for the authenticated student.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (requires STUDENT role).' })
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
  @ApiOperation({ summary: 'Image history by student', description: 'Returns archived previous image versions for a student sorted by most recent replacement.' })
  @ApiParam({ name: 'studentId', description: 'Student ID (MongoDB ObjectId)', example: '6650a1f2c3d4e5f6a7b8c9d0' })
  @ApiResponse({ status: 200, description: 'Image history for the student.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  findImageHistoryByStudentId(
    @Param('studentId', MongoObjectIdPipe) studentId: string,
  ) {
    return this.imagesService.findHistoryByStudentId(studentId);
  }

  @Get('student/:studentId')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Images by student', description: 'Returns all images for a specific student. Requires ADMIN or EMPLOYEE role.' })
  @ApiParam({ name: 'studentId', description: 'Student ID (MongoDB ObjectId)', example: '6650a1f2c3d4e5f6a7b8c9d0' })
  @ApiResponse({ status: 200, description: 'Images for the student.' })
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Student not found.' })
  findByStudentId(@Param('studentId', MongoObjectIdPipe) studentId: string) {
    return this.imagesService.findByStudentId(studentId);
  }

  @Get(':id/file')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Get my image file by id', description: 'Returns full base64 payload for one image document of the authenticated student.' })
  @ApiParam({ name: 'id', description: 'Image ID (MongoDB ObjectId)', example: '6650a1f2c3d4e5f6a7b8c9d0' })
  @ApiResponse({ status: 200, description: 'Image file payload.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions or image does not belong to authenticated student.' })
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
  @ApiOperation({ summary: 'Find image by ID', description: 'Returns the data of a specific image.' })
  @ApiParam({ name: 'id', description: 'Image ID (MongoDB ObjectId)', example: '6650a1f2c3d4e5f6a7b8c9d0' })
  @ApiResponse({ status: 200, description: 'Image data.' })
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Image not found.' })
  findOne(@Param('id', MongoObjectIdPipe) id: string) {
    return this.imagesService.findOne(id);
  }

  @Patch('student/:studentId/profile')
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update student profile photo', description: 'Updates the profile photo of a specific student by ID. Requires EMPLOYEE or ADMIN role.' })
  @ApiParam({ name: 'studentId', description: 'Student ID (MongoDB ObjectId)', example: '6650a1f2c3d4e5f6a7b8c9d0' })
  @ApiBody({ type: UpdateImageDto })
  @ApiResponse({ status: 200, description: 'Profile photo updated successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid data.' })
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Student or image not found.' })
  updateByStudentId(
    @Param('studentId', MongoObjectIdPipe) studentId: string,
    @Body() dto: UpdateImageDto,
  ) {
    return this.imagesService.updateByStudentId(studentId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update image by ID', description: 'Updates the data of a specific image. Requires EMPLOYEE or ADMIN role.' })
  @ApiParam({ name: 'id', description: 'Image ID (MongoDB ObjectId)', example: '6650a1f2c3d4e5f6a7b8c9d0' })
  @ApiBody({ type: UpdateImageDto })
  @ApiResponse({ status: 200, description: 'Image updated successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid data.' })
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
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
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (requires ADMIN role).' })
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
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (requires ADMIN role).' })
  @ApiResponse({ status: 404, description: 'Image not found.' })
  remove(@Param('id', MongoObjectIdPipe) id: string) {
    return this.imagesService.remove(id);
  }
}