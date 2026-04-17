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
  @ApiOperation({ summary: 'List all students' })
  @ApiResponse({ status: 200, description: 'List of students.' })
  findAll(
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const page = Math.max(1, Number.parseInt(pageRaw ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(limitRaw ?? '20', 10) || 20));
    return this.studentService.findAllPaginated(page, limit);
  }

  @Post('schedule')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Submit class schedule' })
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
    ], {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Submit student profile, schedule and images in one request',
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
    },
  ) {
    await this.licenseRequestService.assertInitialRequestEligibility(
      req.sessionPayload!.userId,
    );

    const result = await this.studentService.submitLicenseRequest(
      req.sessionPayload!.userId,
      dto,
      files ?? {},
    );

    await this.licenseRequestService.createRequest(req.sessionPayload!.userId);

    return result;
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
    summary: 'Submit document update request with selected changed documents',
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
  @ApiResponse({ status: 201, description: 'Update request submitted successfully.' })
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
  @ApiOperation({ summary: 'Upload profile photo' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photo'],
      properties: { photo: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Photo updated.' })
  updateProfilePhoto(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedImageFile,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    return this.studentService.updateProfilePhoto(user.id, file);
  }

  @Delete('me/photo')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Remove profile photo' })
  @ApiResponse({ status: 200, description: 'Photo removed.' })
  removeProfilePhoto(@CurrentUser() user: AuthenticatedUser) {
    return this.studentService.removeProfilePhoto(user.id);
  }

  @Get('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Get own profile' })
  @ApiResponse({ status: 200, description: 'Student profile.' })
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
  @ApiOperation({ summary: 'Dashboard statistics for all students' })
  @ApiResponse({
    status: 200,
    description: 'Aggregated student statistics.',
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
  @ApiOperation({ summary: 'Find student by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Student data.' })
  @ApiResponse({ status: 400, description: 'Invalid ID.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  findOne(@Param('id', MongoObjectIdPipe) id: string) {
    return this.studentService.findOneOrFail(id);
  }

  @Patch('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Update own profile' })
  @ApiBody({ type: UpdateStudentProfileDto })
  @ApiResponse({ status: 200, description: 'Profile updated.' })
  updateProfile(
    @Req() req: Request,
    @Body() dto: UpdateStudentProfileDto,
  ) {
    return this.studentService.update(req.sessionPayload!.userId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Update student by ID (admin or employee)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiBody({ type: UpdateStudentDto })
  @ApiResponse({ status: 200, description: 'Student updated.' })
  @ApiResponse({ status: 400, description: 'Invalid data or ID.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  update(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Remove student (admin only)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Student removed.' })
  @ApiResponse({ status: 400, description: 'Invalid ID.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  remove(@Param('id', MongoObjectIdPipe) id: string) {
    return this.studentService.remove(id);
  }

 @Get('by-bus/:busIdentifier')
 @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
 @ApiOperation({ summary: 'List students by bus identifier' })
 @ApiParam({ name: 'busIdentifier', description: 'Bus identifier string (ex: "Ônibus 03")' })
 @ApiResponse({ status: 200, description: 'Students assigned to bus.' })
 findByBus(@Param('busIdentifier') busIdentifier: string) {
   return this.studentService.findByBus(busIdentifier);
 }
}
