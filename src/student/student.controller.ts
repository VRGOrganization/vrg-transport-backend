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

/**
 * Rotas de gestão de students.
 * - Admin e Employee podem listar e ver qualquer student.
 * - Student só pode ver e editar o próprio perfil.
 * - Apenas admin pode remover.
 */
@Controller('student')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  findAll() {
    return this.studentService.findAll();
  }

  @Get('me')
  @Roles(UserRole.STUDENT)
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.studentService.findOneOrFail(user.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  findOne(@Param('id') id: string) {
    return this.studentService.findOneOrFail(id);
  }

  @Patch('me')
  @Roles(UserRole.STUDENT)
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentService.update(user.id, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.studentService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.studentService.remove(id);
  }
}
