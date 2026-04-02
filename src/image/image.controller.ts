import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ImagesService } from './image.service';
import { CreateImageDto, UpdateImageDto, UploadMyDocumentDto } from './dto/image.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/interfaces/user-roles.enum';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MongoObjectIdPipe } from '../common/pipes/mongo-object-id.pipe';
import { AuthenticatedUser } from '../auth/interfaces/auth.interface';

@ApiTags('Images')
@Controller('image')
@UseGuards(JwtAuthGuard, RolesGuard)
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
  findAll() {
    return this.imagesService.findAll();
  }

  @Post('me')
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload my document', description: 'Student uploads a document (profile photo, enrollment proof, course schedule).' })
  @ApiBody({ type: UploadMyDocumentDto })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid data or file format.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 409, description: 'Document of this type already exists.' })
  uploadMyDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadMyDocumentDto,
  ) {
    return this.imagesService.createForStudent(user.id, dto);
  }

  @Get('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'My images', description: 'Returns all images for the authenticated student.' })
  @ApiResponse({ status: 200, description: 'Images for the authenticated student.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (requires STUDENT role).' })
  findMyImages(@CurrentUser() user: AuthenticatedUser) {
    return this.imagesService.findByStudentId(user.id);
  }

  @Get('me/profile')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'My profile photo', description: 'Returns the profile photo of the authenticated student.' })
  @ApiResponse({ status: 200, description: 'Profile photo of the authenticated student.' })
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (requires STUDENT role).' })
  @ApiResponse({ status: 404, description: 'Profile photo not found.' })
  findMyProfilePhoto(@CurrentUser() user: any) {
    return this.imagesService.findProfilePhoto(user.id);
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