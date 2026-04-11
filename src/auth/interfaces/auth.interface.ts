import { UserRole } from '../../common/interfaces/user-roles.enum';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  identifier: string;
  name: string;
}

export interface SessionRequestContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface SessionAuthResponse {
  ok: true;
  sessionId: string;
  user: AuthenticatedUser;
}

export interface LogoutResponse {
  ok: true;
}
