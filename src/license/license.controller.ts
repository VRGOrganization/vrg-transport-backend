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
import { CreateLicenseDto, RejectLicenseDto } from './dto/create-license.dto';
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
    description: 'Ticket efêmero e de uso único emitido por /license/events/token.',
  })
  streamEvents(
    @Query('ticket') ticket: string,
  ): Observable<MessageEvent> {
    const studentId = this.licenseService.consumeSseTicket(ticket);
    return this.licenseService.streamByStudent(studentId);
  }

  @Get('/verify/:code')
  @Public()
  @ApiOperation({
    summary: 'Verificar autenticidade de carteirinha',
    description: 'Rota pública. Valida se uma carteirinha existe e está ativa pelo código de verificação do QR code.',
  })
  @ApiParam({ name: 'code', description: 'Código de verificação (UUID gerado na emissão)' })
  @ApiResponse({ status: 200, description: 'Resultado da verificação.' })
  async verify(@Param('code') code: string) {
    return this.licenseService.verifyByCode(code);
  }

  @Post('/create')
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create License',
    description:
      'Emits a new student license. Requires EMPLOYEE or ADMIN role.',
  })
  @ApiBody({ type: CreateLicenseDto })
  @ApiResponse({ status: 201, description: 'License created successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid data.' })
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  async create(
    @Body() dto: CreateLicenseDto,
    @Req() req: Request,
  ) {
    return this.licenseService.create(dto, req.sessionPayload!.userId);
  }

  @Get('/health')
  @ApiOperation({
    summary: 'Health check do serviço de licenças',
    description:
      'Verifica o status do serviço externo de geração de carteirinhas. Disponível para ADMIN ou EMPLOYEE.',
  })
  @ApiResponse({ status: 200, description: 'Service is operational.' })
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions (requires EMPLOYEE or ADMIN role).',
  })
  checkHealth() {
    return this.licenseService.checkHealth();
  }

  @Get('/all')
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  @ApiOperation({
    summary: 'List all licenses',
    description: 'Returns all registered licenses.',
  })
  @ApiResponse({ status: 200, description: 'List of licenses.' })
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions (requires EMPLOYEE or ADMIN role).',
  })
  async findAll() {
    return this.licenseService.getAll();
  }

  @Get('/searchByStudent/:studentId')
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)

  @ApiOperation({
    summary: 'Find license by student ID',
    description: 'Returns the license associated with a specific student.',
  })
  @ApiParam({
    name: 'studentId',
    description: 'Student ID (MongoDB ObjectId)',
    example: '6650a1f2c3d4e5f6a7b8c9d0',
  })
  @ApiResponse({ status: 200, description: 'License for the student.' })
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions (requires EMPLOYEE or ADMIN role).',
  })
  @ApiResponse({
    status: 404,
    description: 'License not found for this student.',
  })
  async findByStudent(
    @Param('studentId', MongoObjectIdPipe) studentId: string,
  ) {
    return this.licenseService.getLicenseByStudentId(studentId);
  }

  @Get('/me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({
    summary: 'Get my license',
    description: 'Returns the license of the authenticated student.',
  })
  @ApiResponse({ status: 200, description: 'License data.' })
  @ApiResponse({ status: 404, description: 'License not found.' })
  async findMine(@Req() req: Request) {
    return this.licenseService.getLicenseByStudentId(req.sessionPayload!.userId);
  }

  @Get('/:id')
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Find license by ID',
    description: 'Returns the data of a specific license.',
  })
  @ApiParam({
    name: 'id',
    description: 'License ID (MongoDB ObjectId)',
    example: '6650a1f2c3d4e5f6a7b8c9d0',
  })
  @ApiResponse({ status: 200, description: 'License data.' })
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions (requires EMPLOYEE or ADMIN role).',
  })
  @ApiResponse({ status: 404, description: 'License not found.' })
  async findOne(@Param('id', MongoObjectIdPipe) id: string) {
    return this.licenseService.getLicenseById(id);
  }

  @Patch('/update/:id')
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update license',
    description: 'Updates the data of an existing license.',
  })
  @ApiParam({
    name: 'id',
    description: 'License ID (MongoDB ObjectId)',
    example: '6650a1f2c3d4e5f6a7b8c9d0',
  })
  @ApiBody({ type: CreateLicenseDto })
  @ApiResponse({ status: 200, description: 'License updated successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid data.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions (requires EMPLOYEE or ADMIN role).',
  })
  @ApiResponse({ status: 404, description: 'License not found.' })
  async update(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() dto: CreateLicenseDto,
    @Req() req: Request,
  ) {
    return this.licenseService.update(id, dto, req.sessionPayload!.userId);
  }

  @Patch('/reject/:id')
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Recusar carteirinha',
    description: 'Marca a licença como recusada e notifica o aluno por email.',
  })
  @ApiParam({ name: 'id', description: 'License ID (MongoDB ObjectId)' })
  @ApiBody({ type: RejectLicenseDto })
  @ApiResponse({ status: 200, description: 'Licença recusada com sucesso.' })
  @ApiResponse({ status: 404, description: 'Licença não encontrada.' })
  async reject(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() dto: RejectLicenseDto,
    @Req() req: Request,
  ) {
    return this.licenseService.reject(id, dto.reason, req.sessionPayload!.userId);
  }

  @Delete('/delete/:id')
  @ApiOperation({
    summary: 'Remove license',
    description: 'Removes a license permanently.',
  })
  @ApiParam({
    name: 'id',
    description: 'License ID (MongoDB ObjectId)',
    example: '6650a1f2c3d4e5f6a7b8c9d0',
  })
  @ApiResponse({ status: 200, description: 'License removed successfully.' })
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions (requires ADMIN role).',
  })
  @ApiResponse({ status: 404, description: 'License not found.' })
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', MongoObjectIdPipe) id: string) {
    return this.licenseService.remove(id);
  }
}
