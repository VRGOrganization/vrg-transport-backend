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
import { UniversityService } from '../university/university.service';

@ApiTags('Buses')
@Controller('bus')
export class BusController {
  constructor(
    private readonly service: BusService,
    private readonly universityService: UniversityService,
  ) {}

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
  async findAll() {
    const buses = await this.service.findAll();

    const uniCache = new Map<string, string | null>();

    const mapped = [] as any[];
    for (const bus of buses || []) {
      const identifier = (bus as any).identifier ?? '';
      const id = (bus as any)._id?.toString?.() ?? identifier;

      const acronyms: string[] = [];
      for (const slot of (bus.universitySlots || [])) {
        const raw = slot?.universityId;
        const uid = raw ? (typeof raw === 'string' ? raw : raw?.toString?.()) : null;
        if (!uid) continue;
        if (!uniCache.has(uid)) {
          try {
            const uni = await this.universityService.findOneOrFail(uid);
            uniCache.set(uid, uni.acronym ?? (uni.name ? uni.name.split(/\s+/).map((w: string) => w[0]).join('').toUpperCase() : uid));
          } catch {
            uniCache.set(uid, null);
          }
        }
        const a = uniCache.get(uid);
        if (a) acronyms.push(a);
      }

      const destinations = acronyms.length > 0 ? acronyms.map((a) => ({ name: a, active: true })) : [];

      mapped.push({ _id: id, lineNumber: identifier, destinations });
    }

    return mapped;
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
  @ApiQuery({ name: 'quantity', required: false, description: 'Quantidade de vagas a liberar (opcional). Quando omitido, zera todos os filledSlots.' })
  @HttpCode(HttpStatus.OK)
  releaseSlots(
    @Param('id', MongoObjectIdPipe) id: string,
    @Query('promote') promote: string | undefined,
    @Query('quantity') quantity: string | undefined,
    @Req() req: Request,
  ) {
    const doPromote = promote === undefined ? true : promote === 'true';
    const q = quantity === undefined ? undefined : Number.parseInt(quantity as string, 10);
    return this.service.releaseSlotsForBus(id, req.sessionPayload!.userId, doPromote, q);
  }

  @Patch(':id/resync-filled-slots')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Recalcular filledSlots do ônibus a partir dos students atribuídos (admin)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId do ônibus' })
  @HttpCode(HttpStatus.OK)
  resyncFilledSlots(@Param('id', MongoObjectIdPipe) id: string, @Req() req: Request) {
    return this.service.resyncFilledSlots(id, req.sessionPayload!.userId);
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