import { RolesGuard } from '../guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../common/interfaces/user-roles.enum';
import { ExecutionContext } from '@nestjs/common';

const makeContext = (user: any): ExecutionContext =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as any;

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const mockRoles = (roles: UserRole[] | undefined) => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false as any)
      .mockReturnValueOnce(roles as any);
  };

  it('deve permitir acesso quando não há roles definidas na rota', () => {
    mockRoles(undefined);

    const ctx = makeContext({ role: UserRole.STUDENT });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('deve permitir acesso quando o role bate com o requerido', () => {
    mockRoles([UserRole.ADMIN]);

    const ctx = makeContext({ role: UserRole.ADMIN, identifier: 'admin' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('deve negar acesso quando o role não bate', () => {
    mockRoles([UserRole.ADMIN]);

    const ctx = makeContext({ role: UserRole.STUDENT, identifier: 'joao@test.com' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('deve negar acesso quando não há user na requisição', () => {
    mockRoles([UserRole.ADMIN]);

    const ctx = makeContext(null);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('deve permitir acesso a qualquer role listada', () => {
    mockRoles([UserRole.ADMIN, UserRole.EMPLOYEE]);

    const ctx = makeContext({ role: UserRole.EMPLOYEE, identifier: 'MAT001' });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});