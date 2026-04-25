import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { UserRole } from '../../common/interfaces/user-roles.enum';

const mockAuthService = {
  registerStudent: jest.fn(),
  verifyStudentEmail: jest.fn(),
  resendVerificationCode: jest.fn(),
  loginStudent: jest.fn(),
  loginEmployee: jest.fn(),
  loginAdmin: jest.fn(),
  logout: jest.fn(),
};

describe('AuthController (Fase 2 - Session First)', () => {
  let controller: AuthController;

  beforeEach(() => {
    controller = new AuthController(mockAuthService as unknown as AuthService);
    jest.clearAllMocks();
  });

  it('deve expor perfil em /auth/me via sessionPayload', () => {
    const request = {
      sessionPayload: {
        userId: 'student-id-123',
        userType: UserRole.STUDENT,
      },
    } as any;

    const result = controller.getMe(request);

    expect(result).toEqual({
      userId: 'student-id-123',
      userType: UserRole.STUDENT,
    });
  });

  it('deve enviar contexto de sessão no login do estudante', async () => {
    mockAuthService.loginStudent.mockResolvedValue({ ok: true, sessionId: 'sid' });

    const request = {
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest-agent' },
    } as any;

    await controller.loginStudent(
      { email: 'aluno@test.com', password: 'Senha123' },
      request,
    );

    expect(mockAuthService.loginStudent).toHaveBeenCalledWith(
      { email: 'aluno@test.com', password: 'Senha123' },
      { userAgent: 'jest-agent', ipAddress: '127.0.0.1' },
    );
  });

  it('logout deve ser idempotente e funcionar sem x-session-id', async () => {
    mockAuthService.logout.mockResolvedValue({ ok: true });

    const request = { headers: {} } as any;
    const result = await controller.logout(request);

    expect(result).toEqual({ ok: true });
    expect(mockAuthService.logout).toHaveBeenCalledWith(undefined);
  });

  it('logout deve revogar sessão quando x-session-id existir', async () => {
    mockAuthService.logout.mockResolvedValue({ ok: true });

    const request = {
      headers: { 'x-session-id': '507f1f77bcf86cd799439011' },
    } as any;

    const result = await controller.logout(request);

    expect(result).toEqual({ ok: true });
    expect(mockAuthService.logout).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
    );
  });
});
