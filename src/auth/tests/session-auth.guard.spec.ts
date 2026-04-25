import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { SessionAuthGuard } from '../guards/session-auth.guard';
import { SessionService } from '../session/session.service';
import { UserRole } from '../../common/interfaces/user-roles.enum';

const mockSessionService = {
  validateSession: jest.fn(),
};

const mockReflector = {
  getAllAndOverride: jest.fn(),
} as unknown as Reflector;

const makeExecutionContext = (request: Record<string, unknown>) =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  }) as any;

describe('SessionAuthGuard', () => {
  let guard: SessionAuthGuard;

  beforeEach(() => {
    guard = new SessionAuthGuard(
      mockSessionService as unknown as SessionService,
      mockReflector,
    );

    jest.clearAllMocks();
  });

  it('deve permitir rota pública sem validar sessão', async () => {
    (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(true);

    const request = { headers: {} };
    const context = makeExecutionContext(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(mockSessionService.validateSession).not.toHaveBeenCalled();
  });

  it('deve rejeitar quando x-session-id não for enviado', async () => {
    (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(false);

    const request = { headers: {} };
    const context = makeExecutionContext(request);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Sessão não encontrada.'),
    );
  });

  it('deve rejeitar sessão inválida/expirada', async () => {
    (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    mockSessionService.validateSession.mockResolvedValue(null);

    const request = {
      headers: { 'x-session-id': '507f1f77bcf86cd799439011' },
    };
    const context = makeExecutionContext(request);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Sessão inválida ou expirada.'),
    );
  });

  it('deve injetar sessionPayload e user quando sessão for válida', async () => {
    (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    mockSessionService.validateSession.mockResolvedValue({
      sessionId: '507f1f77bcf86cd799439011',
      userId: 'student-id-123',
      userType: UserRole.STUDENT,
      expiresAt: new Date(Date.now() + 60_000),
      lastSeenAt: new Date(),
      revoked: false,
    });

    const request: Record<string, unknown> = {
      headers: { 'x-session-id': '507f1f77bcf86cd799439011' },
    };
    const context = makeExecutionContext(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect((request as any).sessionPayload.userId).toBe('student-id-123');
    expect((request as any).user).toEqual({
      id: 'student-id-123',
      role: UserRole.STUDENT,
      identifier: 'student-id-123',
      name: 'student-id-123',
    });
  });
});
