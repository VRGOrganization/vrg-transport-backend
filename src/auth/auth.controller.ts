import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  StudentLoginDto,
  EmployeeLoginDto,
  AdminLoginDto,
  RegisterStudentDto,
  VerifyEmailDto,
  ResendCodeDto,
} from './dto/auth.dto';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { UserRole } from '../common/interfaces/user-roles.enum';
import type { AuthenticatedUser } from './interfaces/auth.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Student ──────────────────────────────────────────────────────────────

  @Public()
  @Post('student/register')
  @HttpCode(HttpStatus.CREATED)
  registerStudent(@Body() dto: RegisterStudentDto) {
    return this.authService.registerStudent(dto);
  }

  @Public()
  @Post('student/verify')
  @HttpCode(HttpStatus.OK)
  verifyStudentEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyStudentEmail(dto);
  }

  @Public()
  @Post('student/resend-code')
  @HttpCode(HttpStatus.OK)
  resendVerificationCode(@Body() dto: ResendCodeDto) {
    return this.authService.resendVerificationCode(dto);
  }

  @Public()
  @Post('student/login')
  @HttpCode(HttpStatus.OK)
  loginStudent(@Body() dto: StudentLoginDto) {
    return this.authService.loginStudent(dto);
  }

  // ─── Employee ─────────────────────────────────────────────────────────────

  @Public()
  @Post('employee/login')
  @HttpCode(HttpStatus.OK)
  loginEmployee(@Body() dto: EmployeeLoginDto) {
    return this.authService.loginEmployee(dto);
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  @Public()
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  loginAdmin(@Body() dto: AdminLoginDto) {
    return this.authService.loginAdmin(dto);
  }

  // ─── Shared ───────────────────────────────────────────────────────────────

  /**
   * Retorna o perfil do usuário autenticado.
   * Disponível para todos os roles — cada um vê seu próprio dado.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  // ─── Exemplo de rota restrita ─────────────────────────────────────────────

  @Get('admin/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  adminDashboard(@CurrentUser() user: AuthenticatedUser) {
    return { message: 'Área administrativa', admin: user.identifier };
  }
}
