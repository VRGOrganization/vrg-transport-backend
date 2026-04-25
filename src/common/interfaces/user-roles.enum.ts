/*
  Define user roles para controle de acesso e permissões dentro do sistema.
  A enumeração UserRole inclui três papéis: ADMIN, EMPLOYEE e STUDENT.
  Esses papéis podem ser usados para atribuir diferentes níveis de acesso e funcionalidades aos usuários do sistema, 
  permitindo uma gestão mais eficiente e segura dos recursos e operações disponíveis.
*/

export enum UserRole {
  ADMIN = 'admin',
  EMPLOYEE = 'employee',
  STUDENT = 'student',
}