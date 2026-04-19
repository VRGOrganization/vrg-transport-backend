import {
  Controller,
  Get,
  Post,
  Sse,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { LicenseService } from './license.service';
import {
  CreateLicenseDto,
  RejectLicenseDto,
  UpdateLicenseDto,
} from './dto/create-license.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserRole } from '../common/interfaces/user-roles.enum';
import { MongoObjectIdPipe } from '../common/pipes/mongo-object-id.pipe';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Licenses')
@Controller('license')
@Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Post('/events/token')
  @Roles(UserRole.STUDENT)
  @ApiOperation({
    summary: 'Emitir ticket efêmero para SSE',
    description:
      'Gera ticket de uso único para conexão do stream de eventos de licença.',
  })
  @ApiResponse({ status: 200, description: 'Ticket SSE emitido com sucesso.' })
  issueEventsTicket(@Req() req: Request) {
    return this.licenseService.issueSseTicket(req.sessionPayload!.userId);
  }

  @Sse('/events')
  @Public()
  @ApiOperation({
    summary: 'Stream de eventos da licença do aluno (SSE)',
    description:
      'Canal SSE por aluno autenticado via ticket efêmero na query string.',
  })
  @ApiQuery({
    name: 'ticket',
    required: true,
    description:
      'Ticket efêmero e de uso único emitido por /license/events/token.',
  })
  streamEvents(@Query('ticket') ticket: string): Observable<MessageEvent> {
    const studentId = this.licenseService.consumeSseTicket(ticket);
    return this.licenseService.streamByStudent(studentId);
  }

  @Get('/verify/:code')
  @Public()
  @ApiOperation({
    summary: 'Verificar autenticidade de carteirinha',
    description:
      'Rota pública. Valida se uma carteirinha existe e está ativa pelo código de verificação do QR code.',
  })
  @ApiParam({
    name: 'code',
    description: 'Código de verificação (UUID gerado na emissão)',
  })
  @ApiResponse({ status: 200, description: 'Resultado da verificação.' })
  async verify(@Param('code') code: string) {
    return this.licenseService.verifyByCode(code);
  }

  @Post('/create')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Criar carteirinha',
    description:
      'Emite uma nova carteirinha do estudante. Requer papel ADMIN.',
  })
  @ApiBody({ type: CreateLicenseDto })
  @ApiResponse({ status: 201, description: 'Carteirinha criada com sucesso.' })
  @ApiResponse({ status: 400, description: 'Dados inválidos.' })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  @ApiResponse({ status: 403, description: 'Permissão insuficiente.' })
  async create(@Body() dto: CreateLicenseDto, @Req() req: Request) {
    return this.licenseService.create(dto, req.sessionPayload!.userId);
  }

  @Get('/health')
  @ApiOperation({
    summary: 'Verificar sa?de do servi?o de licen?as',
    description:
      'Verifica o status do servi?o externo de gera??o de carteirinhas. Dispon?vel para ADMIN.',
  })
  @ApiResponse({ status: 200, description: 'Servi?o operacional.' })
  @ApiResponse({ status: 401, description: 'N?o autenticado.' })
  @ApiResponse({
    status: 403,
    description: 'Permiss?o insuficiente (requer papel EMPLOYEE ou ADMIN).',
  })
  checkHealth() {
    return this.licenseService.checkHealth();
  }

  @Get('/all')
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Listar carteirinhas',
    description: 'Retorna todas as carteirinhas cadastradas.',
  })
  @ApiResponse({ status: 200, description: 'Lista de carteirinhas.' })
  @ApiResponse({ status: 401, description: 'N?o autenticado.' })
  @ApiResponse({
    status: 403,
    description: 'Permiss?o insuficiente (requer papel EMPLOYEE ou ADMIN).',
  })
  async findAll() {
    return this.licenseService.getAll();
  }

  @Get('/searchByStudent/:studentId')
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Buscar carteirinha por aluno',
    description: 'Retorna a carteirinha associada a um aluno espec?fico.',
  })
  @ApiParam({
    name: 'studentId',
    description: 'Student ID (MongoDB ObjectId)',
    example: '6650a1f2c3d4e5f6a7b8c9d0',
  })
  @ApiResponse({ status: 200, description: 'Carteirinha do aluno.' })
  @ApiResponse({ status: 401, description: 'N?o autenticado.' })
  @ApiResponse({
    status: 403,
    description: 'Permiss?o insuficiente (requer papel EMPLOYEE ou ADMIN).',
  })
  @ApiResponse({
    status: 404,
    description: 'Carteirinha n?o encontrada para este aluno.',
  })
  async findByStudent(
    @Param('studentId', MongoObjectIdPipe) studentId: string,
  ) {
    return this.licenseService.getLicenseByStudentId(studentId);
  }

  @Get('/me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({
    summary: 'Buscar minha carteirinha',
    description: 'Retorna a carteirinha do estudante autenticado.',
  })
  @ApiResponse({ status: 200, description: 'Dados da carteirinha.' })
  @ApiResponse({ status: 404, description: 'Carteirinha n?o encontrada.' })
  async findMine(@Req() req: Request) {
    return this.licenseService.getLicenseByStudentId(
      req.sessionPayload!.userId,
    );
  }

  @Get('/:id')
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Buscar carteirinha por ID',
    description: 'Retorna os dados de uma carteirinha espec?fica.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID da carteirinha (MongoDB ObjectId)',
    example: '6650a1f2c3d4e5f6a7b8c9d0',
  })
  @ApiResponse({ status: 200, description: 'Dados da carteirinha.' })
  @ApiResponse({ status: 401, description: 'N?o autenticado.' })
  @ApiResponse({
    status: 403,
    description: 'Permiss?o insuficiente (requer papel EMPLOYEE ou ADMIN).',
  })
  @ApiResponse({ status: 404, description: 'Carteirinha n?o encontrada.' })
  async findOne(@Param('id', MongoObjectIdPipe) id: string) {
    return this.licenseService.getLicenseById(id);
  }

  @Patch('/update/:id')
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Atualizar carteirinha',
    description: 'Atualiza os dados de uma carteirinha existente.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID da carteirinha (MongoDB ObjectId)',
    example: '6650a1f2c3d4e5f6a7b8c9d0',
  })
  @ApiBody({ type: CreateLicenseDto })
  @ApiResponse({ status: 200, description: 'Carteirinha atualizada com sucesso.' })
  @ApiResponse({ status: 400, description: 'Dados inv?lidos.' })
  @ApiResponse({ status: 401, description: 'N?o autenticado.' })
  @ApiResponse({
    status: 403,
    description: 'Permiss?o insuficiente (requer papel EMPLOYEE ou ADMIN).',
  })
  @ApiResponse({ status: 404, description: 'Carteirinha n?o encontrada.' })
  async update(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() dto: UpdateLicenseDto,
    @Req() req: Request,
  ) {
    return this.licenseService.update(id, dto, req.sessionPayload!.userId);
  }

  @Patch('/reject/:id')
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Recusar carteirinha',
    description: 'Marca a carteirinha como recusada e notifica o aluno por email.',
  })
  @ApiParam({ name: 'id', description: 'ID da carteirinha (MongoDB ObjectId)' })
  @ApiBody({ type: RejectLicenseDto })
  @ApiResponse({ status: 200, description: 'Carteirinha recusada com sucesso.' })
  @ApiResponse({ status: 404, description: 'Carteirinha n?o encontrada.' })
  async reject(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() dto: RejectLicenseDto,
    @Req() req: Request,
  ) {
    return this.licenseService.reject(
      id,
      dto.reason,
      req.sessionPayload!.userId,
    );
  }

  @Delete('/delete/:id')
  @ApiOperation({
    summary: 'Remover carteirinha',
    description: 'Remove uma carteirinha permanentemente.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID da carteirinha (MongoDB ObjectId)',
    example: '6650a1f2c3d4e5f6a7b8c9d0',
  })
  @ApiResponse({ status: 200, description: 'Carteirinha removida com sucesso.' })
  @ApiResponse({ status: 401, description: 'N?o autenticado.' })
  @ApiResponse({
    status: 403,
    description: 'Permiss?o insuficiente (requer papel ADMIN).',
  })
  @ApiResponse({ status: 404, description: 'Carteirinha n?o encontrada.' })
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', MongoObjectIdPipe) id: string, @Req() req: Request) {
    return this.licenseService.remove(id, req.sessionPayload!.userId);
  }
}
