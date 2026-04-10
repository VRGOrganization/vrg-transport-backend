# Roles e Permissões

## Roles

| Enum | Valor em sessão | Descrição |
|---|---|---|
| `UserRole.ADMIN` | `admin` | Gestão total do sistema |
| `UserRole.EMPLOYEE` | `employee` | Operação e análise de solicitações |
| `UserRole.STUDENT` | `student` | Operações do próprio perfil |

## Matriz por módulo

### App

| Endpoint | Público | STUDENT | EMPLOYEE | ADMIN |
|---|---|---|---|---|
| `GET /` | ✅ | ✅ | ✅ | ✅ |

### Auth (todos exigem `x-service-secret`)

| Endpoint | Público | STUDENT | EMPLOYEE | ADMIN |
|---|---|---|---|---|
| `POST /auth/student/register` | ✅ | — | — | — |
| `POST /auth/student/verify` | ✅ | — | — | — |
| `POST /auth/student/resend-code` | ✅ | — | — | — |
| `POST /auth/student/login` | ✅ | — | — | — |
| `POST /auth/employee/login` | ✅ | — | — | — |
| `POST /auth/admin/login` | ✅ | — | — | — |
| `GET /auth/me` | ❌ | ✅ | ✅ | ✅ |
| `POST /auth/logout` | ✅ | ✅ | ✅ | ✅ |
| `GET /auth/admin/dashboard` | ❌ | ❌ | ❌ | ✅ |

### Students

| Endpoint | STUDENT | EMPLOYEE | ADMIN |
|---|---|---|---|
| `GET /student` | ❌ | ✅ | ✅ |
| `POST /student/schedule` | ✅ | ❌ | ❌ |
| `POST /student/me/license-submit` | ✅ | ❌ | ❌ |
| `POST /student/me/document-update-request` | ✅ | ❌ | ❌ |
| `PATCH /student/me/photo` | ✅ | ❌ | ❌ |
| `DELETE /student/me/photo` | ✅ | ❌ | ❌ |
| `GET /student/me` | ✅ | ❌ | ❌ |
| `GET /student/stats/dashboard` | ❌ | ✅ | ✅ |
| `GET /student/:id` | ❌ | ✅ | ✅ |
| `PATCH /student/me` | ✅ | ❌ | ❌ |
| `PATCH /student/:id` | ❌ | ✅ | ✅ |
| `DELETE /student/:id` | ❌ | ❌ | ✅ |

### Employees

| Endpoint | STUDENT | EMPLOYEE | ADMIN |
|---|---|---|---|
| `POST /employee` | ❌ | ❌ | ✅ |
| `GET /employee` | ❌ | ❌ | ✅ |
| `GET /employee/inactive` | ❌ | ❌ | ✅ |
| `GET /employee/:id` | ❌ | ❌ | ✅ |
| `PATCH /employee/:id` | ❌ | ❌ | ✅ |
| `DELETE /employee/:id` | ❌ | ❌ | ✅ |

### License Requests

| Endpoint | STUDENT | EMPLOYEE | ADMIN |
|---|---|---|---|
| `GET /license-request/all` | ❌ | ✅ | ✅ |
| `GET /license-request/pending` | ❌ | ✅ | ✅ |
| `GET /license-request/me` | ✅ | ❌ | ❌ |
| `GET /license-request/student/:studentId` | ❌ | ✅ | ✅ |
| `PATCH /license-request/approve/:id` | ❌ | ✅ | ✅ |
| `PATCH /license-request/reject/:id` | ❌ | ✅ | ✅ |

### Licenses

| Endpoint | Público | STUDENT | EMPLOYEE | ADMIN |
|---|---|---|---|---|
| `POST /license/events/token` | ❌ | ✅ | ❌ | ❌ |
| `GET /license/events?ticket=...` | ✅ | ✅ (via ticket) | ✅ (via ticket) | ✅ (via ticket) |
| `GET /license/verify/:code` | ✅ | ✅ | ✅ | ✅ |
| `POST /license/create` | ❌ | ❌ | ❌ | ✅ |
| `GET /license/health` | ❌ | ❌ | ✅ | ✅ |
| `GET /license/all` | ❌ | ❌ | ✅ | ✅ |
| `GET /license/searchByStudent/:studentId` | ❌ | ❌ | ✅ | ✅ |
| `GET /license/me` | ❌ | ✅ | ❌ | ❌ |
| `GET /license/:id` | ❌ | ❌ | ✅ | ✅ |
| `PATCH /license/update/:id` | ❌ | ❌ | ✅ | ✅ |
| `PATCH /license/reject/:id` | ❌ | ❌ | ✅ | ✅ |
| `DELETE /license/delete/:id` | ❌ | ❌ | ❌ | ✅ |

### Images

| Endpoint | STUDENT | EMPLOYEE | ADMIN |
|---|---|---|---|
| `POST /image` | ❌ | ✅ | ✅ |
| `GET /image` | ❌ | ✅ | ✅ |
| `POST /image/me` | ✅ | ❌ | ❌ |
| `GET /image/me` | ✅ | ❌ | ❌ |
| `GET /image/me/profile` | ✅ | ❌ | ❌ |
| `GET /image/student/me` | ✅ | ❌ | ❌ |
| `GET /image/history/student/:studentId` | ❌ | ✅ | ✅ |
| `GET /image/student/:studentId` | ❌ | ✅ | ✅ |
| `GET /image/:id/file` | ✅ (somente dono) | ❌ | ❌ |
| `GET /image/:id` | ❌ | ✅ | ✅ |
| `PATCH /image/student/:studentId/profile` | ❌ | ✅ | ✅ |
| `PATCH /image/:id` | ❌ | ✅ | ✅ |
| `DELETE /image/student/:studentId` | ❌ | ❌ | ✅ |
| `DELETE /image/:id` | ❌ | ❌ | ✅ |
