import {
  Controller,
  Get,
  Patch,
  Param,
  Delete,
  Body,
  UseGuards,
} from '@nestjs/common';
import { StudentService } from './student.service';
import { UpdateStudentDto } from './dto/student.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/interfaces/user-roles.enum';
import { MongoObjectIdPipe } from '../common/pipes/mongo-object-id.pipe';
import { ApiBody, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';

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
  @ApiBody({ type: UpdateStudentDto })
  @ApiResponse({ status: 200, description: 'Profile updated.' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateStudentDto,
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