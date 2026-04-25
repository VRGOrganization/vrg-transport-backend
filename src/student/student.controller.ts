import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Delete,
  Body,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Req,
  Query,
} from '@nestjs/common';
import type { Request } from 'express';
import { StudentService } from './student.service';
import {
  SubmitLicenseRequestFormDto,
  SubmitScheduleDto,
  UpdateStudentProfileDto,
  UpdateStudentDto,
} from './dto/student.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/interfaces/user-roles.enum';
import { MongoObjectIdPipe } from '../common/pipes/mongo-object-id.pipe';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { LicenseRequestService } from '../license-request/license-request.service';

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
};

@ApiTags('Students')
@Controller('student')
export class StudentController {
  constructor(
    private readonly studentService: StudentService,
    private readonly licenseRequestService: LicenseRequestService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Listar estudantes' })
  @ApiResponse({ status: 200, description: 'List of students.' })
  findAll(
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const page = Math.max(1, Number.parseInt(pageRaw ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(limitRaw ?? '20', 10) || 20));
    return this.studentService.findAllPaginated(page, limit);
  }

  @Get('inactive')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Listar estudantes inativos' })
  @ApiResponse({ status: 200, description: 'Lista de estudantes inativos.' })
  findAllInactive() {
    return this.studentService.findAllInactive();
  }

  @Post('schedule')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Enviar grade hor?ria' })
  @ApiBody({ type: SubmitScheduleDto })
  @ApiResponse({ status: 200, description: 'Schedule saved.' })
  submitSchedule(
    @Req() req: Request,
    @Body() dto: SubmitScheduleDto,
  ) {
    return this.studentService.updateSchedule(req.sessionPayload!.userId, dto.selections);
  }

  @Post('me/license-submit')
  @Roles(UserRole.STUDENT)
    @UseInterceptors(
      FileFieldsInterceptor([
        { name: 'ProfilePhoto', maxCount: 1 },
        { name: 'EnrollmentProof', maxCount: 1 },
        { name: 'CourseSchedule', maxCount: 1 },
        { name: 'GovernmentId', maxCount: 1 },
        { name: 'ProofOfResidence', maxCount: 1 },
      ], {
        limits: { fileSize: 10 * 1024 * 1024 },
      }),
    )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Enviar perfil, grade e imagens em uma ?nica requisi??o',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['schedule'],
      properties: {
        institution: { type: 'string' },
        degree: { type: 'string' },
        shift: { type: 'string' },
        bloodType: { type: 'string' },
        schedule: {
          type: 'string',
          example: '[{"day":"SEG","period":"Manhã"}]',
        },
        ProfilePhoto: { type: 'string', format: 'binary' },
        EnrollmentProof: { type: 'string', format: 'binary' },
        CourseSchedule: { type: 'string', format: 'binary' },
        GovernmentId: { type: 'string', format: 'binary' },
        ProofOfResidence: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Data submitted successfully.' })
  async submitLicenseRequest(
    @Req() req: Request,
    @Body() dto: SubmitLicenseRequestFormDto,
    @UploadedFiles()
    files: {
      ProfilePhoto?: UploadedImageFile[];
      EnrollmentProof?: UploadedImageFile[];
      CourseSchedule?: UploadedImageFile[];
      GovernmentId?: UploadedImageFile[];
      ProofOfResidence?: UploadedImageFile[];
    },
  ) {
    return this.licenseRequestService.submitAndCreateRequest(
      req.sessionPayload!.userId,
      dto,
      files ?? {},
    );
  }

  @Post('me/document-update-request')
  @Roles(UserRole.STUDENT)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'ProfilePhoto', maxCount: 1 },
      { name: 'EnrollmentProof', maxCount: 1 },
      { name: 'CourseSchedule', maxCount: 1 },
    ], {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Enviar solicita??o de atualiza??o de documentos selecionados',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['changedDocuments'],
      properties: {
        changedDocuments: {
          type: 'string',
          example: '["ProfilePhoto","EnrollmentProof"]',
        },
        ProfilePhoto: { type: 'string', format: 'binary' },
        EnrollmentProof: { type: 'string', format: 'binary' },
        CourseSchedule: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Solicita??o de atualiza??o enviada com sucesso.' })
  async submitDocumentUpdateRequest(
    @Req() req: Request,
    @Body('changedDocuments') changedDocumentsRaw: string,
    @UploadedFiles()
    files: {
      ProfilePhoto?: UploadedImageFile[];
      EnrollmentProof?: UploadedImageFile[];
      CourseSchedule?: UploadedImageFile[];
    },
  ) {
    return this.licenseRequestService.submitDocumentUpdateRequest(
      req.sessionPayload!.userId,
      changedDocumentsRaw,
      files ?? {},
    );
  }

  @Patch('me/photo')
  @Roles(UserRole.STUDENT)
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Enviar foto de perfil' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photo'],
      properties: { photo: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Foto atualizada.' })
  updateProfilePhoto(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedImageFile,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    return this.studentService.updateProfilePhoto(user.id, file);
  }

  @Delete('me/photo')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Remover foto de perfil' })
  @ApiResponse({ status: 200, description: 'Foto removida.' })
  removeProfilePhoto(@CurrentUser() user: AuthenticatedUser) {
    return this.studentService.removeProfilePhoto(user.id);
  }

  @Get('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Obter meu perfil' })
  @ApiResponse({ status: 200, description: 'Perfil do estudante.' })
  async getProfile(@Req() req: Request) {
    const studentId = req.sessionPayload!.userId;
    const student = await this.studentService.findOneOrFail(studentId);
    const photo = await this.studentService.getProfilePhotoOrNull(studentId);

    const studentDoc = student as unknown as {
      toJSON?: () => Record<string, unknown>;
    };
    const studentJson =
      typeof studentDoc.toJSON === 'function'
        ? studentDoc.toJSON()
        : (student as unknown as Record<string, unknown>);

    return {
      ...studentJson,
      photo,
    };
  }

  @Get('stats/dashboard')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Estat?sticas do painel de estudantes' })
  @ApiResponse({
    status: 200,
    description: 'Estat?sticas agregadas dos estudantes.',
    schema: {
      example: {
        totalStudents: 120,
        studentsWithCard: 45,
        studentsWithoutCard: 30,
        studentsWithPendingRequest: 45,
        transport: {
          totalUsing: 90,
          byShift: {
            morning: 40,
            afternoon: 25,
            night: 15,
            fullTime: 10,
          },
          byDay: {
            SEG: 85,
            TER: 80,
            QUA: 78,
            QUI: 82,
            SEX: 60,
          },
        },
        generatedAt: '2025-04-07T12:00:00.000Z',
      },
    },
  })
  getDashboardStats() {
    return this.studentService.getDashboardStats();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Buscar estudante por ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Student data.' })
  @ApiResponse({ status: 400, description: 'ID inv?lido.' })
  @ApiResponse({ status: 404, description: 'N?o encontrado.' })
  findOne(@Param('id', MongoObjectIdPipe) id: string) {
    return this.studentService.findOneOrFail(id);
  }

  @Patch('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Atualizar meu perfil' })
  @ApiBody({ type: UpdateStudentProfileDto })
  @ApiResponse({ status: 200, description: 'Perfil atualizado.' })
  updateProfile(
    @Req() req: Request,
    @Body() dto: UpdateStudentProfileDto,
  ) {
    return this.studentService.update(req.sessionPayload!.userId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Atualizar estudante por ID (admin ou funcion?rio)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiBody({ type: UpdateStudentDto })
  @ApiResponse({ status: 200, description: 'Estudante atualizado.' })
  @ApiResponse({ status: 400, description: 'Dados ou ID inv?lidos.' })
  @ApiResponse({ status: 404, description: 'N?o encontrado.' })
  update(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Remover estudante (apenas admin)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Student removed.' })
  @ApiResponse({ status: 400, description: 'ID inv?lido.' })
  @ApiResponse({ status: 404, description: 'N?o encontrado.' })
  remove(@Param('id', MongoObjectIdPipe) id: string) {
    return this.studentService.remove(id);
  }

 @Get('by-bus/:busIdentifier')
 @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
 @ApiOperation({ summary: 'Listar estudantes por identificador do ?nibus' })
 @ApiParam({ name: 'busIdentifier', description: 'Bus identifier string (ex: "Ônibus 03")' })
 @ApiResponse({ status: 200, description: 'Estudantes vinculados ao ?nibus.' })
 findByBus(@Param('busIdentifier') busIdentifier: string) {
   return this.studentService.findByBus(busIdentifier);
 }

  @Get('by-bus-id/:busId')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Listar estudantes por ID do ?nibus' })
  @ApiParam({ name: 'busId', description: 'ObjectId MongoDB do ?nibus' })
  @ApiResponse({ status: 200, description: 'Estudantes vinculados ao ?nibus.' })
  findByBusId(@Param('busId') busId: string) {
    return this.studentService.findByBusId(busId);
  }
}
