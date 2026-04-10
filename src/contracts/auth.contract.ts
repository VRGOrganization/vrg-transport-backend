import { z } from 'zod';

export const UserTypeSchema = z.enum(['student', 'employee', 'admin']);

export const AuthMeResponseSchema = z.object({
  userId: z.string().min(1),
  userType: UserTypeSchema,
});

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

export const HttpErrorResponseSchema = z.object({
  statusCode: z.number().int(),
  message: z.union([z.string(), z.array(z.string())]),
  timestamp: z.string().min(1),
  path: z.string().optional(),
});
