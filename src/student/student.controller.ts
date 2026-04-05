import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Delete,
  Body,
  UseGuards,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { StudentService } from './student.service';
import {
  SubmitLicenseRequestFormDto,
  SubmitScheduleDto,
  UpdateStudentProfileDto,
  UpdateStudentDto,
} from './dto/student.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/interfaces/user-roles.enum';
import { MongoObjectIdPipe } from '../common/pipes/mongo-object-id.pipe';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
};

@ApiTags('Students')
@ApiBearerAuth()
@Controller('student')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'List all students' })
  @ApiResponse({ status: 200, description: 'List of students.' })
  findAll() {
    return this.studentService.findAll();
  }

  @Post('schedule')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Submit class schedule' })
  @ApiBody({ type: SubmitScheduleDto })
  @ApiResponse({ status: 200, description: 'Schedule saved.' })
  submitSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitScheduleDto,
  ) {
    return this.studentService.updateSchedule(user.id, dto.selections);
  }

  @Post('me/license-submit')
  @Roles(UserRole.STUDENT)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'ProfilePhoto', maxCount: 1 },
      { name: 'EnrollmentProof', maxCount: 1 },
      { name: 'CourseSchedule', maxCount: 1 },
    ]),
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
  submitLicenseRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitLicenseRequestFormDto,
    @UploadedFiles()
    files: {
      ProfilePhoto?: UploadedImageFile[];
      EnrollmentProof?: UploadedImageFile[];
      CourseSchedule?: UploadedImageFile[];
    },
  ) {
    return this.studentService.submitLicenseRequest(user.id, dto, files ?? {});
  }

  @Get('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Get own profile' })
  @ApiResponse({ status: 200, description: 'Student profile.' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.studentService.findOneOrFail(user.id);
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
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateStudentProfileDto,
  ) {
    return this.studentService.update(user.id, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update student by ID (admin only)' })
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
}
