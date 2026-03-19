import { SetMetadata } from '@nestjs/common';

import { ROLES_KEY } from '../constants/auth.constants';
import { UserRole } from 'src/common/interfaces/user-roles.enum';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);