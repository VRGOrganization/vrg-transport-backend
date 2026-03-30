// Decorator para definir os papéis (roles) necessários para acessar uma rota.
// Usado para proteger rotas específicas com base nos papéis do usuário.

import { ROLES_KEY } from '../constants/auth.constants';
import { UserRole } from '../../common/interfaces/user-roles.enum';

export const Roles = (...roles: UserRole[]) => ROLES_KEY(roles);