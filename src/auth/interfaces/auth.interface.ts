import { UserRole } from '../../common/interfaces/user-roles.enum';


export interface JwtPayload {
  sub: string;
  role: UserRole;
  identifier: string;
  tokenUse: 'access' | 'refresh';
  
}

export class AuthenticatedUser {  // class em vez de interface
  id: string;
  role: UserRole;
  identifier: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: AuthenticatedUser;
}