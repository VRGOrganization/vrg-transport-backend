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
import { CreateImageDto, UpdateImageDto } from './dto/image.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/interfaces/user-roles.enum';

@Controller('image')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post()
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateImageDto) {
    return this.imagesService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  findAll() {
    return this.imagesService.findAll();
  }

  @Get('me')
  @Roles(UserRole.STUDENT)
  findMyImages(@CurrentUser() user: any) {
    return this.imagesService.findByStudentId(user.id);
  }

  @Get('me/profile')
  @Roles(UserRole.STUDENT)
  findMyProfilePhoto(@CurrentUser() user: any) {
    return this.imagesService.findProfilePhoto(user.id);
  }

  @Get('student/:studentId')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  findByStudentId(@Param('studentId') studentId: string) {
    return this.imagesService.findByStudentId(studentId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  findOne(@Param('id') id: string) {
    return this.imagesService.findOne(id);
  }

  @Patch('student/:studentId/profile')
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  updateByStudentId(
    @Param('studentId') studentId: string,
    @Body() dto: UpdateImageDto,
  ) {
    return this.imagesService.updateByStudentId(studentId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateImageDto) {
    return this.imagesService.update(id, dto);
  }

  @Delete('student/:studentId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  removeByStudentId(@Param('studentId') studentId: string) {
    return this.imagesService.removeByStudentId(studentId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.imagesService.remove(id);
  }
}