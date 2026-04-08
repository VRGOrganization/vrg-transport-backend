# Roles e Permissões

## Roles Disponíveis

| Role | Valor na sessão | Descrição |
|---|---|---|
| `ADMIN` | `admin` | Acesso total ao sistema |
| `EMPLOYEE` | `employee` | Funcionário municipal — cria licenças, gerencia imagens |
| `STUDENT` | `student` | Estudante — acessa apenas os próprios dados |

---

## Tabela Completa: Endpoint × Role

### Auth

| Endpoint | Público | STUDENT | EMPLOYEE | ADMIN |
|---|---|---|---|---|
| `POST /auth/student/register` | ✅ | — | — | — |
| `POST /auth/student/verify` | ✅ | — | — | — |
| `POST /auth/student/resend-code` | ✅ | — | — | — |
| `POST /auth/student/login` | ✅ | — | — | — |
| `POST /auth/employee/login` | ✅ | — | — | — |
| `POST /auth/admin/login` | ✅ | — | — | — |
| `GET /auth/me` | ❌ | ✅ | ✅ | ✅ |
| `POST /auth/logout` | ❌ | ✅ | ✅ | ✅ |
| `GET /auth/admin/dashboard` | ❌ | ❌ | ❌ | ✅ |

### Students

| Endpoint | STUDENT | EMPLOYEE | ADMIN | Observação |
|---|---|---|---|---|
| `GET /student` | ❌ | ✅ | ✅ | Lista todos |
| `GET /student/me` | ✅ | ❌ | ❌ | Somente o próprio perfil |
| `GET /student/:id` | ❌ | ✅ | ✅ | |
| `PATCH /student/me` | ✅ | ❌ | ❌ | Somente o próprio perfil |
| `PATCH /student/:id` | ❌ | ❌ | ✅ | |
| `DELETE /student/:id` | ❌ | ❌ | ✅ | |

### Employees

| Endpoint | STUDENT | EMPLOYEE | ADMIN |
|---|---|---|---|
| `POST /employee` | ❌ | ❌ | ✅ |
| `GET /employee` | ❌ | ❌ | ✅ |
| `GET /employee/:id` | ❌ | ❌ | ✅ |
| `PATCH /employee/:id` | ❌ | ❌ | ✅ |
| `DELETE /employee/:id` | ❌ | ❌ | ✅ |

### Licenses

| Endpoint | STUDENT | EMPLOYEE | ADMIN | Observação |
|---|---|---|---|---|
| `POST /license/create` | ❌ | ✅ | ✅ | |
| `GET /license/health` | ❌ | ❌ | ✅ | Health check do serviço externo |
| `GET /license/all` | ❌ | ✅ | ✅ | |
| `GET /license/searchByStudent/:studentId` | ❌ | ✅ | ✅ | |
| `GET /license/:id` | ❌ | ✅ | ✅ | |
| `PATCH /license/update/:id` | ❌ | ✅ | ✅ | |
| `DELETE /license/delete/:id` | ❌ | ❌ | ✅ | |

### Images

| Endpoint | STUDENT | EMPLOYEE | ADMIN | Observação |
|---|---|---|---|---|
| `POST /image` | ❌ | ✅ | ✅ | |
| `GET /image` | ❌ | ✅ | ✅ | Lista todas as imagens |
| `GET /image/me` | ✅ | ❌ | ❌ | Imagens do próprio estudante |
| `GET /image/me/profile` | ✅ | ❌ | ❌ | Foto de perfil do próprio estudante |
| `GET /image/student/:studentId` | ❌ | ✅ | ✅ | |
| `GET /image/:id` | ❌ | ✅ | ✅ | |
| `PATCH /image/student/:studentId/profile` | ❌ | ✅ | ✅ | |
| `PATCH /image/:id` | ❌ | ✅ | ✅ | |
| `DELETE /image/student/:studentId` | ❌ | ❌ | ✅ | Remove todas as imagens do estudante |
| `DELETE /image/:id` | ❌ | ❌ | ✅ | |

---

## Como Funciona na Prática

### Guard Chain

Três guards são aplicados globalmente (nesta ordem) em `AppModule`:

```
1. RateLimitGuard  → verifica limite de requisições por IP
2. SessionAuthGuard → valida sessão (pula rotas marcadas com @Public())
3. RolesGuard     → verifica se o role da sessão satisfaz @Roles() do endpoint
```

### Decorators

```typescript
// Rota pública (sem autenticação)
@Public()
@Post('student/register')

// Rota que exige role específico
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
@Get()

// Acesso ao usuário autenticado no controller
@Get('me')
getMe(@CurrentUser() user: AuthenticatedUser) { ... }
```

### Restrições por Perfil

- **STUDENT** só acessa `GET /student/me` e `PATCH /student/me` — nunca dados de outros estudantes
- **STUDENT** só acessa `GET /image/me` e `GET /image/me/profile` — nunca imagens de outros estudantes
- **EMPLOYEE** pode criar e editar licenças, mas **não pode deletar**
- **EMPLOYEE** pode gerenciar imagens de qualquer estudante, mas **não pode deletar**
- **ADMIN** tem acesso total, incluindo todas as operações de deleção

---

## Hierarquia de Roles

Não há herança automática de roles. Cada endpoint declara explicitamente quais roles têm acesso. Um ADMIN precisaria estar listado em `@Roles(UserRole.EMPLOYEE, UserRole.ADMIN)` para acessar um endpoint de EMPLOYEE — o que é feito em todos os endpoints onde faz sentido.
