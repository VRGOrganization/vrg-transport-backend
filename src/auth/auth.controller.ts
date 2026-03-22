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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { UserRole } from '../common/interfaces/user-roles.enum';
import type { AuthenticatedUser } from './interfaces/auth.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  //Student

  @Public()
  @Post('student/register')
  @ApiOperation({ summary: 'Register a new student', description: 'Registers a new student and sends a verification code by email.' })
  @ApiBody({ type: RegisterStudentDto })
  @ApiResponse({ status: 201, description: 'Student registered successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid student data.' })
  @ApiResponse({ status: 409, description: 'E-mail already registered.' })
  @HttpCode(HttpStatus.CREATED)
  registerStudent(@Body() dto: RegisterStudentDto) {
    return this.authService.registerStudent(dto);
  }

  @Public()
  @Post('student/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify student email', description: 'Verifies the student email using the provided verification code.' })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({ status: 200, description: 'Email verified successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid verification code.' })
  verifyStudentEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyStudentEmail(dto);
  }

  @Public()
  @Post('student/resend-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification code', description: 'Resends the verification code to the student email.' })
  @ApiBody({ type: ResendCodeDto })
  @ApiResponse({ status: 200, description: 'Verification code sent successfully.' })
  @ApiResponse({ status: 404, description: 'Student not found.' })
  resendVerificationCode(@Body() dto: ResendCodeDto) {
    return this.authService.resendVerificationCode(dto);
  }

  @Public()
  @Post('student/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Student login', description: 'Authenticates a student and returns an access token.' })
  @ApiBody({ type: StudentLoginDto })
  @ApiResponse({ status: 200, description: 'Login successful, returns access token.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  loginStudent(@Body() dto: StudentLoginDto) {
    return this.authService.loginStudent(dto);
  }

  //Employee

  @Public()
  @Post('employee/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Employee login', description: 'Authenticates an employee and returns an access token.' })
  @ApiBody({ type: EmployeeLoginDto })
  @ApiResponse({ status: 200, description: 'Login successful, returns access token.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  loginEmployee(@Body() dto: EmployeeLoginDto) {
    return this.authService.loginEmployee(dto);
  }

  //Admin

  @Public()
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login', description: 'Authenticates an admin and returns an access token.' })
  @ApiBody({ type: AdminLoginDto })
  @ApiResponse({ status: 200, description: 'Login successful, returns access token.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  loginAdmin(@Body() dto: AdminLoginDto) {
    return this.authService.loginAdmin(dto);
  }

  // Shared

  /**
   * Retorna o perfil do usuário autenticado.
   * Disponível para todos os roles — cada um vê seu próprio dado.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get authenticated user profile', description: 'Returns the profile of the authenticated user.' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  //Exemplo de rota restrita
  @Get('admin/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin dashboard', description: 'Access to the admin dashboard, restricted to admin users.' })
  @ApiResponse({ status: 200, description: 'Access granted to admin dashboard.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. User does not have the required role.' })
  adminDashboard(@CurrentUser() user: AuthenticatedUser) {
    return { message: 'Admin Dashboard', admin: user.identifier };
  }
}
