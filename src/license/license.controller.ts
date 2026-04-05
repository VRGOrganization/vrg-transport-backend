import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LicenseService } from './license.service';
import { CreateLicenseDto } from './dto/create-license.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserRole } from '../common/interfaces/user-roles.enum';
import { MongoObjectIdPipe } from '../common/pipes/mongo-object-id.pipe';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';

@ApiTags('Licenses')
@ApiBearerAuth()
@Controller('license')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

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
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.licenseService.create(dto, user.id);
  }

  //INVESTIGAR SE VAI NECESSARIO MANTER PROTEGIDO POR ROLE ADMIN
  @Get('/health')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Health check do serviço de licenças',
    description:
      'Verifica o status do serviço externo de geração de carteirinhas. Exclusivo para ADMIN.',
  })
  @ApiResponse({ status: 200, description: 'Service is operational.' })
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions (requires ADMIN role).',
  })
  checkHealth() {
    return this.licenseService.checkHealth();
  }

  @Get('/all')
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
  async findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.licenseService.getLicenseByStudentId(user.id);
  }

  @Get('/:id')
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
    @CurrentUser() user: any,
  ) {
    return this.licenseService.update(id, dto, user.id);
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
    description: 'Insufficient permissions (requires EMPLOYEE or ADMIN role).',
  })
  @ApiResponse({ status: 404, description: 'License not found.' })
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', MongoObjectIdPipe) id: string) {
    return this.licenseService.remove(id);
  }
}
