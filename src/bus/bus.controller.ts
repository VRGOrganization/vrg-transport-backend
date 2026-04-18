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
  Query,
  Req,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/interfaces/user-roles.enum';
import { MongoObjectIdPipe } from '../common/pipes/mongo-object-id.pipe';
import { CreateBusDto, LinkUniversityDto, UpdateBusDto, UpdateUniversitySlotsDto } from './dto/bus.dto';
import { BusService } from './bus.service';

@ApiTags('Buses')
@Controller('bus')
export class BusController {
  constructor(private readonly service: BusService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Cadastrar ônibus (admin)' })
  @ApiBody({ type: CreateBusDto })
  @ApiResponse({ status: 201, description: 'Ônibus criado.' })
  @ApiResponse({ status: 409, description: 'Identificador já existe.' })
  create(@Body() dto: CreateBusDto, @Req() req: Request) {
    return this.service.create(dto, req.sessionPayload!.userId);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Listar ônibus ativos' })
  findAll() {
    return this.service.findAll();
  }

  @Get('with-queue-counts')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Resumo das filas por ônibus e universidade (admin)' })
  getWithQueueCounts() {
    return this.service.getQueueCounts();
  }

  @Get('inactive')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar ônibus inativos' })
  findAllInactive() {
    return this.service.findAllInactive();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Buscar ônibus por ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  findOne(@Param('id', MongoObjectIdPipe) id: string) {
    return this.service.findOneOrFail(id);
  }

  @Get(':id/queue-summary')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Resumo detalhado da fila do ônibus (pending + waitlisted) (admin)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  getQueueSummary(@Param('id', MongoObjectIdPipe) id: string) {
    return this.service.getQueueSummary(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Atualizar ônibus' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiBody({ type: UpdateBusDto })
  update(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() dto: UpdateBusDto,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, req.sessionPayload!.userId);
  }

  @Patch(':id/university-slots')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Atualizar faculdades e prioridades do ônibus' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiBody({ type: UpdateUniversitySlotsDto })
  updateUniversitySlots(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() dto: UpdateUniversitySlotsDto,
    @Req() req: Request,
  ) {
    return this.service.updateUniversitySlots(id, dto, req.sessionPayload!.userId);
  }

  @Patch(':id/link-university')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Vincular faculdade ao ônibus' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId do ônibus' })
  @ApiBody({ type: LinkUniversityDto })
  linkUniversity(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() dto: LinkUniversityDto,
    @Req() req: Request,
  ) {
    return this.service.linkUniversity(id, dto.universityId, req.sessionPayload!.userId);
  }

  @Patch(':id/unlink-university')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Desvincular faculdade do ônibus' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId do ônibus' })
  @ApiBody({ type: LinkUniversityDto })
  unlinkUniversity(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() dto: LinkUniversityDto,
    @Req() req: Request,
  ) {
    return this.service.unlinkUniversity(id, dto.universityId, req.sessionPayload!.userId);
  }

  @Patch(':id/release-slots')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Liberar vagas preenchidas do ônibus (zera filledSlots por universidade)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId do ônibus' })
  @ApiQuery({ name: 'promote', required: false, description: 'Se true (default) promove automaticamente waitlisted; enviar promote=false para apenas zerar filledSlots sem promover.' })
  @HttpCode(HttpStatus.OK)
  releaseSlots(
    @Param('id', MongoObjectIdPipe) id: string,
    @Query('promote') promote: string | undefined,
    @Req() req: Request,
  ) {
    const doPromote = promote === undefined ? true : promote === 'true';
    return this.service.releaseSlotsForBus(id, req.sessionPayload!.userId, doPromote);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desativar ônibus (soft delete)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  deactivate(@Param('id', MongoObjectIdPipe) id: string, @Req() req: Request) {
    return this.service.deactivate(id, req.sessionPayload!.userId);
  }
}