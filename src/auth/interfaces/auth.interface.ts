import { UserRole } from '../../common/interfaces/user-roles.enum';

export interface JwtPayload {
  email: string;
  role: UserRole;
  
}

export interface LoginResponse {
  access_token: string;
  user: {
 
    email: string;
    name: string;
    role: UserRole;
  };
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}