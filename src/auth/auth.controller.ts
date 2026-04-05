import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { CookieService } from './services/cookie.service';

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
  ApiCookieAuth,
} from '@nestjs/swagger';

import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { RateLimit } from './decorators/rate-limit.decorator';

import { UserRole } from '../common/interfaces/user-roles.enum';
import type { AuthenticatedUser, LoginResponse } from './interfaces/auth.interface';
import { AUTH_ERROR_MESSAGES } from './constants/auth.constants';

@ApiTags('Auth')
@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookieService: CookieService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // REGISTER
  // ═══════════════════════════════════════════════════════════════════════════

  @Public()
  @RateLimit({ points: 20, windowMs: 60_000, keyPrefix: 'auth:register' })
  @Post('student/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new student' })
  @ApiBody({ type: RegisterStudentDto })
  @ApiResponse({ status: 201, description: 'Student registered successfully.' })
  @ApiResponse({ status: 409, description: 'E-mail already registered.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  registerStudent(
    @Body() dto: RegisterStudentDto,
  ): Promise<{ message: string; isInstitutional: boolean }> {
    return this.authService.registerStudent(dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFY EMAIL
  // ═══════════════════════════════════════════════════════════════════════════

  @Public()
  @RateLimit({ points: 5, windowMs: 60_000, keyPrefix: 'auth:verify' })
  @Post('student/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify student email via OTP' })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({ status: 200, description: 'Email verified. Sets refresh_token cookie.' })
  @ApiResponse({ status: 400, description: 'Account already active.' })
  @ApiResponse({ status: 401, description: 'Invalid or expired code.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  verifyStudentEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    return this.authService.verifyStudentEmail(dto, res);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESEND CODE
  // ═══════════════════════════════════════════════════════════════════════════

  @Public()
  @RateLimit({ points: 3, windowMs: 60_000, keyPrefix: 'auth:resend' })
  @Post('student/resend-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification code' })
  @ApiBody({ type: ResendCodeDto })
  @ApiResponse({ status: 200, description: 'Code sent if applicable.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  resendVerificationCode(
    @Body() dto: ResendCodeDto,
  ): Promise<{ message: string }> {
    return this.authService.resendVerificationCode(dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════════════════════

  @Public()
  @RateLimit({ points: 5, windowMs: 60_000, keyPrefix: 'auth:student-login' })
  @Post('student/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Student login' })
  @ApiBody({ type: StudentLoginDto })
  @ApiResponse({ status: 200, description: 'Login successful. Sets refresh_token cookie.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  loginStudent(
    @Body() dto: StudentLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    return this.authService.loginStudent(dto, res);
  }

  @Public()
  @RateLimit({ points: 5, windowMs: 60_000, keyPrefix: 'auth:employee-login' })
  @Post('employee/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Employee login' })
  @ApiBody({ type: EmployeeLoginDto })
  @ApiResponse({ status: 200, description: 'Login successful. Sets refresh_token cookie.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  loginEmployee(
    @Body() dto: EmployeeLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    return this.authService.loginEmployee(dto, res);
  }

  @Public()
  @RateLimit({ points: 3, windowMs: 60_000, keyPrefix: 'auth:admin-login' })
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login' })
  @ApiBody({ type: AdminLoginDto })
  @ApiResponse({ status: 200, description: 'Login successful. Sets refresh_token cookie.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  loginAdmin(
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    return this.authService.loginAdmin(dto, res);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REFRESH
  //
  // Decisão: NÃO aceita body. Lê exclusivamente do cookie HTTP-only.
  //
  // Por que @Public() aqui?
  //   O JwtAuthGuard global rejeitaria a request antes de chegarmos ao método,
  //   pois o access token já expirou (é exatamente o motivo do refresh).
  //   Com @Public() o guard deixa passar e o service valida o refresh token.
  //
  // Por que não ter um RefreshGuard?
  //   Seria over-engineering: a validação do refresh token já está encapsulada
  //   no TokenService.verifyRefreshToken() + lógica de versão no AuthService.
  // ═══════════════════════════════════════════════════════════════════════════

  @Public()
  @RateLimit({ points: 10, windowMs: 60_000, keyPrefix: 'auth:refresh' })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('refresh_token')
  @ApiOperation({ summary: 'Refresh session — reads refresh_token from HTTP-only cookie' })
  @ApiResponse({ status: 200, description: 'New access token issued. Cookie rotated.' })
  @ApiResponse({ status: 401, description: 'Missing, invalid or revoked refresh token.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    // Extrai o token do cookie via CookieService — nome canônico centralizado
    const rawToken = this.cookieService.extractRefreshToken(
      req.cookies as Record<string, string>,
    );

    if (!rawToken) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.REFRESH_TOKEN_INVALID);
    }

    return this.authService.refreshToken(rawToken, res);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ME
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getMe(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGOUT
  //
  // Requer access token válido (JwtAuthGuard).
  // O cookie de refresh é limpado pelo AuthService via CookieService.
  // O controller não toca mais em cookies diretamente.
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout — revokes refresh token and clears cookie' })
  @ApiResponse({ status: 200, description: 'Logged out.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    return this.authService.logout(user, res);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('admin/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin dashboard — restricted' })
  @ApiResponse({ status: 200, description: 'Access granted.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  adminDashboard(
    @CurrentUser() user: AuthenticatedUser,
  ): { message: string; admin: string } {
    return { message: 'Admin Dashboard', admin: user.identifier };
  }
}