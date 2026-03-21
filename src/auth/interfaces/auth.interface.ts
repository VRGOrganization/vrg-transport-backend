import { UserRole } from '../../common/interfaces/user-roles.enum';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  //identicador legivel por role - usado no validate() da strategy
  identifier: string;
  
}

// auth.interface.ts
export class AuthenticatedUser {  // class em vez de interface
  id: string;
  role: UserRole;
  identifier: string;
}

export interface LoginResponse {
  access_token: string;
  user: AuthenticatedUser;
}