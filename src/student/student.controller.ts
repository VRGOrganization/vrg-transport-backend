import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Delete,
  Body,
  UploadedFiles,
  UseInterceptors,
  Req,
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
import { FileFieldsInterceptor } from '@nestjs/platform-express';

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
};

@ApiTags('Students')
@Controller('student')
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
    @Req() req: Request,
    @Body() dto: SubmitLicenseRequestFormDto,
    @UploadedFiles()
    files: {
      ProfilePhoto?: UploadedImageFile[];
      EnrollmentProof?: UploadedImageFile[];
      CourseSchedule?: UploadedImageFile[];
    },
  ) {
    return this.studentService.submitLicenseRequest(req.sessionPayload!.userId, dto, files ?? {});
  }

  @Get('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Get own profile' })
  @ApiResponse({ status: 200, description: 'Student profile.' })
  getProfile(@Req() req: Request) {
    return this.studentService.findOneOrFail(req.sessionPayload!.userId);
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
}
