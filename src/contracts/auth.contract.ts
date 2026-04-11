// Define Zod schemas para documentar as respostas da API de autenticação, 
// como parte do contrato do módulo Auth.
// Esses schemas são usados para validar e tipar as respostas das rotas de autenticação,
// garantindo consistência e segurança na comunicação entre frontend e backend.

import { z } from 'zod';

// Define os tipos de usuário suportados
export const UserTypeSchema = z.enum(['student', 'employee', 'admin']);

// Esquema para a resposta da rota de autenticação (login)
export const AuthMeResponseSchema = z.object({
  userId: z.string().min(1),
  userType: UserTypeSchema,
});

// Esquema para os detalhes do usuário retornados pelo backend
export const SessionAuthResponseSchema = z.object({
  ok: z.literal(true),
  sessionId: z.string().min(1),
  user: z.object({
    id: z.string().min(1),
    role: UserTypeSchema,
    identifier: z.string().min(1),
    name: z.string().min(1),
  }),
});

// Esquema para erros HTTP retornados pela API
export const HttpErrorResponseSchema = z.object({
  statusCode: z.number().int(),
  message: z.union([z.string(), z.array(z.string())]),
  timestamp: z.string().min(1),
  path: z.string().optional(),
});
