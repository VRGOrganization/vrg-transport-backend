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
import { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

/**
 * Rotas de gestão de students.
 * - Admin e Employee podem listar e ver qualquer student.
 * - Student só pode ver e editar o próprio perfil.
 * - Apenas admin pode remover.
 */
@ApiTags('Students')
@Controller('student')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'List all students', description: 'Returns a list of all registered students. Accessible by admin and employee roles.' })
  @ApiResponse({ status: 200, description: 'List of all registered students.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  findAll() {
    return this.studentService.findAll();
  }

  @Get('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Get student profile', description: 'Returns the profile of the authenticated student.' })
  @ApiResponse({ status: 200, description: 'Student profile retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.studentService.findOneOrFail(user.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Find student by ID', description: 'Returns the data of a specific student. Requires ADMIN or EMPLOYEE role.' })
  @ApiParam({ name: 'id', description: 'Student ID (MongoDB ObjectId)', example: '6650a1f2c3d4e5f6a7b8c9d0' })
  @ApiResponse({ status: 200, description: 'Student data.' })
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Student not found.' })
  findOne(@Param('id') id: string) {
    return this.studentService.findOneOrFail(id);
  }

  @Patch('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Update my profile', description: 'Updates the data of the authenticated student.' })
  @ApiBody({ type: UpdateStudentDto })
  @ApiResponse({ status: 200, description: 'Profile updated successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid data.' })
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (requires STUDENT role).' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentService.update(user.id, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update student by ID', description: 'Updates the data of a specific student. Exclusive to ADMIN.' })
  @ApiParam({ name: 'id', description: 'Student ID (MongoDB ObjectId)', example: '6650a1f2c3d4e5f6a7b8c9d0' })
  @ApiBody({ type: UpdateStudentDto })
  @ApiResponse({ status: 200, description: 'Student updated successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid data.' })
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (requires ADMIN role).' })
  @ApiResponse({ status: 404, description: 'Student not found.' })
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.studentService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Remove student', description: 'Removes a student by ID. Exclusive to ADMIN.' })
  @ApiParam({ name: 'id', description: 'Student ID (MongoDB ObjectId)', example: '6650a1f2c3d4e5f6a7b8c9d0' })
  @ApiResponse({ status: 200, description: 'Student removed successfully.' })
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (requires ADMIN role).' })
  @ApiResponse({ status: 404, description: 'Student not found.' })
  remove(@Param('id') id: string) {
    return this.studentService.remove(id);
  }
}
