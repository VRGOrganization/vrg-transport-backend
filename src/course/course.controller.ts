import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/interfaces/user-roles.enum';
import { MongoObjectIdPipe } from '../common/pipes/mongo-object-id.pipe';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';
import { CourseService } from './course.service';

@ApiTags('Courses')
@Controller('course')
@Roles(UserRole.ADMIN)
export class CourseController {
  constructor(private readonly service: CourseService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastrar curso em uma faculdade (admin)' })
  @ApiBody({ type: CreateCourseDto })
  @ApiResponse({ status: 201, description: 'Curso criado.' })
  @ApiResponse({ status: 404, description: 'Faculdade não encontrada.' })
  @ApiResponse({ status: 409, description: 'Curso já existe nesta faculdade.' })
  create(@Body() dto: CreateCourseDto, @Req() req: Request) {
    return this.service.create(dto, req.sessionPayload!.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os cursos ativos' })
  findAll() {
    return this.service.findAll();
  }

  @Get('inactive')
  @ApiOperation({ summary: 'Listar todos os cursos inativos' })
  findAllInactive() {
    return this.service.findAllInactive();
  }

  @Get('by-university/:universityId')
  @ApiOperation({ summary: 'Listar cursos ativos de uma faculdade' })
  @ApiParam({ name: 'universityId', description: 'MongoDB ObjectId da faculdade' })
  @Roles(UserRole.ADMIN, UserRole.STUDENT)
  findByUniversity(@Param('universityId', MongoObjectIdPipe) universityId: string) {
    return this.service.findByUniversity(universityId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar curso por ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  findOne(@Param('id', MongoObjectIdPipe) id: string) {
    return this.service.findOneOrFail(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar curso' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiBody({ type: UpdateCourseDto })
  update(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() dto: UpdateCourseDto,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, req.sessionPayload!.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desativar curso (soft delete)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  deactivate(@Param('id', MongoObjectIdPipe) id: string, @Req() req: Request) {
    return this.service.deactivate(id, req.sessionPayload!.userId);
  }
}