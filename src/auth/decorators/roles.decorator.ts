import { ROLES_KEY } from '../constants/auth.constants';
import { UserRole } from '../../common/interfaces/user-roles.enum';

export const Roles = (...roles: UserRole[]) => ROLES_KEY(roles);