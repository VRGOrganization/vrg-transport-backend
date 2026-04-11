# Roles e Permissoes

## Roles

| Role | Valor de sessao | Escopo |
|---|---|---|
| ADMIN | admin | Gestao total |
| EMPLOYEE | employee | Operacao de atendimento |
| STUDENT | student | Operacoes do proprio cadastro |

## Auth (todos exigem x-service-secret)

| Endpoint | Publico | STUDENT | EMPLOYEE | ADMIN |
|---|---|---|---|---|
| POST /auth/student/register | sim | - | - | - |
| POST /auth/student/verify | sim | - | - | - |
| POST /auth/student/resend-code | sim | - | - | - |
| POST /auth/student/login | sim | - | - | - |
| POST /auth/employee/login | sim | - | - | - |
| POST /auth/admin/login | sim | - | - | - |
| GET /auth/me | nao | sim | sim | sim |
| POST /auth/logout | sim | sim | sim | sim |
| GET /auth/admin/dashboard | nao | nao | nao | sim |

## Students

| Endpoint | STUDENT | EMPLOYEE | ADMIN |
|---|---|---|---|
| GET /student | nao | sim | sim |
| POST /student/schedule | sim | nao | nao |
| POST /student/me/license-submit | sim | nao | nao |
| POST /student/me/document-update-request | sim | nao | nao |
| PATCH /student/me/photo | sim | nao | nao |
| DELETE /student/me/photo | sim | nao | nao |
| GET /student/me | sim | nao | nao |
| GET /student/stats/dashboard | nao | sim | sim |
| GET /student/:id | nao | sim | sim |
| PATCH /student/me | sim | nao | nao |
| PATCH /student/:id | nao | sim | sim |
| DELETE /student/:id | nao | nao | sim |

## Employees

Todos os endpoints de employee exigem ADMIN.

## Enrollment Period

| Endpoint | STUDENT | EMPLOYEE | ADMIN |
|---|---|---|---|
| POST /enrollment-period | nao | nao | sim |
| GET /enrollment-period | nao | nao | sim |
| GET /enrollment-period/active | sim | sim | sim |
| PATCH /enrollment-period/:id | nao | nao | sim |
| PATCH /enrollment-period/:id/close | nao | nao | sim |
| PATCH /enrollment-period/:id/reopen | nao | nao | sim |
| GET /enrollment-period/:id/waitlist | nao | nao | sim |
| POST /enrollment-period/:id/release-slots | nao | nao | sim |
| POST /enrollment-period/:id/confirm-release | nao | nao | sim |

## License Request

| Endpoint | STUDENT | EMPLOYEE | ADMIN |
|---|---|---|---|
| GET /license-request/all | nao | sim | sim |
| GET /license-request/pending | nao | sim | sim |
| GET /license-request/me | sim | nao | nao |
| GET /license-request/student/:studentId | nao | sim | sim |
| PATCH /license-request/approve/:id | nao | sim | sim |
| PATCH /license-request/reject/:id | nao | sim | sim |

## License

| Endpoint | Publico | STUDENT | EMPLOYEE | ADMIN |
|---|---|---|---|---|
| POST /license/events/token | nao | sim | nao | nao |
| GET /license/events?ticket=... | sim (ticket) | sim | sim | sim |
| GET /license/verify/:code | sim | sim | sim | sim |
| POST /license/create | nao | nao | nao | sim |
| GET /license/health | nao | nao | sim | sim |
| GET /license/all | nao | nao | sim | sim |
| GET /license/searchByStudent/:studentId | nao | nao | sim | sim |
| GET /license/me | nao | sim | nao | nao |
| GET /license/:id | nao | nao | sim | sim |
| PATCH /license/update/:id | nao | nao | sim | sim |
| PATCH /license/reject/:id | nao | nao | sim | sim |
| DELETE /license/delete/:id | nao | nao | nao | sim |

## Image

| Endpoint | STUDENT | EMPLOYEE | ADMIN |
|---|---|---|---|
| POST /image | nao | sim | sim |
| GET /image | nao | sim | sim |
| POST /image/me | sim | nao | nao |
| GET /image/me | sim | nao | nao |
| GET /image/me/profile | sim | nao | nao |
| GET /image/student/me | sim | nao | nao |
| GET /image/history/student/:studentId | nao | sim | sim |
| GET /image/student/:studentId | nao | sim | sim |
| GET /image/:id/file | sim (somente dono) | nao | nao |
| GET /image/:id | nao | sim | sim |
| PATCH /image/student/:studentId/profile | nao | sim | sim |
| PATCH /image/:id | nao | sim | sim |
| DELETE /image/student/:studentId | nao | nao | sim |
| DELETE /image/:id | nao | nao | sim |
