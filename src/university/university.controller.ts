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
import { CreateUniversityDto, UpdateUniversityDto } from './dto/university.dto';
import { UniversityService } from './university.service';

@ApiTags('Universities')
@Controller('university')
// ← removido @Roles(UserRole.ADMIN) daqui
export class UniversityController {
  constructor(private readonly service: UniversityService) {}

  @Post()
  @Roles(UserRole.ADMIN)  // ← apenas ADMIN cria
  @ApiOperation({ summary: 'Cadastrar faculdade (admin)' })
  @ApiBody({ type: CreateUniversityDto })
  @ApiResponse({ status: 201, description: 'Faculdade criada.' })
  @ApiResponse({ status: 409, description: 'Sigla já existe.' })
  create(@Body() dto: CreateUniversityDto, @Req() req: Request) {
    return this.service.create(dto, req.sessionPayload!.userId);
  }

  @Get()
  // ← sem @Roles: qualquer usuário autenticado acessa (ADMIN, EMPLOYEE, STUDENT)
  @ApiOperation({ summary: 'Listar faculdades ativas' })
  findAll() {
    return this.service.findAll();
  }

  @Get('inactive')
  @Roles(UserRole.ADMIN)  // ← apenas ADMIN vê inativas
  @ApiOperation({ summary: 'Listar faculdades inativas' })
  findAllInactive() {
    return this.service.findAllInactive();
  }

  @Get(':id')
  // ← sem @Roles: qualquer autenticado pode buscar por ID se precisar
  @ApiOperation({ summary: 'Buscar faculdade por ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiResponse({ status: 404, description: 'Não encontrada.' })
  findOne(@Param('id', MongoObjectIdPipe) id: string) {
    return this.service.findOneOrFail(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)  // ← apenas ADMIN edita
  @ApiOperation({ summary: 'Atualizar faculdade' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiBody({ type: UpdateUniversityDto })
  update(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() dto: UpdateUniversityDto,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, req.sessionPayload!.userId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)  
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desativar faculdade (soft delete)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  deactivate(@Param('id', MongoObjectIdPipe) id: string, @Req() req: Request) {
    return this.service.deactivate(id, req.sessionPayload!.userId);
  }
}