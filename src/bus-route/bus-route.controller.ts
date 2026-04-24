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
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserRole } from '../common/interfaces/user-roles.enum';
import { MongoObjectIdPipe } from '../common/pipes/mongo-object-id.pipe';
import {
  AddBusRouteDestinationDto,
  CreateBusRouteDto,
  UpdateBusRouteDto,
} from './dto/bus-route.dto';
import { BusRouteService } from './bus-route.service';

@ApiTags('Bus Routes')
@Controller('bus-route')
@Roles(UserRole.ADMIN)
export class BusRouteController {
  constructor(private readonly service: BusRouteService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastrar rota de ônibus (admin)' })
  @ApiBody({ type: CreateBusRouteDto })
  @ApiResponse({ status: 201, description: 'Rota criada.' })
  create(@Body() dto: CreateBusRouteDto, @Req() req: Request) {
    return this.service.create(dto, req.sessionPayload!.userId);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Listar rotas ativas' })
  findAll() {
    return this.service.findAll();
  }

  @Get('inactive')
  @ApiOperation({ summary: 'Listar rotas inativas' })
  findAllInactive() {
    return this.service.findAllInactive();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar rota por ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  findOne(@Param('id', MongoObjectIdPipe) id: string) {
    return this.service.findOneOrFail(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar rota de ônibus' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiBody({ type: UpdateBusRouteDto })
  update(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() dto: UpdateBusRouteDto,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, req.sessionPayload!.userId);
  }

  @Post(':id/destinations')
  @ApiOperation({ summary: 'Adicionar destino à rota' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiBody({ type: AddBusRouteDestinationDto })
  addDestination(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() dto: AddBusRouteDestinationDto,
    @Req() req: Request,
  ) {
    return this.service.addDestination(id, dto, req.sessionPayload!.userId);
  }

  @Delete(':id/destinations/:destinationName')
  @ApiOperation({ summary: 'Remover destino da rota' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiParam({ name: 'destinationName', description: 'Nome do destino' })
  removeDestination(
    @Param('id', MongoObjectIdPipe) id: string,
    @Param('destinationName') destinationName: string,
    @Req() req: Request,
  ) {
    return this.service.removeDestination(id, destinationName, req.sessionPayload!.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desativar rota de ônibus (soft delete)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  deactivate(@Param('id', MongoObjectIdPipe) id: string, @Req() req: Request) {
    return this.service.deactivate(id, req.sessionPayload!.userId);
  }
}
