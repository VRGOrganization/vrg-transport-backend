# Papéis e permissões

## Papéis

| Role | Escopo |
|---|---|
| `ADMIN` | gestão total do sistema |
| `EMPLOYEE` | operação de atendimento |
| `STUDENT` | ações do próprio cadastro |

## Visão resumida

### Auth

- rotas de registro/login/verify/reset exigem `x-service-secret`
- `GET /auth/me` exige sessão
- `GET /auth/admin/dashboard` exige `ADMIN`

### Student

| Endpoint | STUDENT | EMPLOYEE | ADMIN |
|---|---|---|---|
| `GET /student` | - | sim | sim |
| `GET /student/inactive` | - | sim | sim |
| `POST /student/schedule` | sim | - | - |
| `POST /student/me/license-submit` | sim | - | - |
| `POST /student/me/document-update-request` | sim | - | - |
| `PATCH /student/me/photo` | sim | - | - |
| `DELETE /student/me/photo` | sim | - | - |
| `GET /student/me` | sim | - | - |
| `GET /student/stats/dashboard` | - | sim | sim |
| `GET /student/:id` | - | sim | sim |
| `PATCH /student/me` | sim | - | - |
| `PATCH /student/:id` | - | sim | sim |
| `DELETE /student/:id` | - | - | sim |

### License Request

| Endpoint | STUDENT | EMPLOYEE | ADMIN |
|---|---|---|---|
| `GET /license-request/me` | sim | - | - |
| `GET /license-request/all` | - | sim | sim |
| `GET /license-request/pending` | - | sim | sim |
| `GET /license-request/student/:studentId` | - | sim | sim |
| `PATCH /license-request/approve/:id` | - | sim | sim |
| `PATCH /license-request/reject/:id` | - | sim | sim |

### License

| Endpoint | STUDENT | EMPLOYEE | ADMIN |
|---|---|---|---|
| `POST /license/events/token` | sim | - | - |
| `GET /license/events?ticket=...` | sim | sim | sim |
| `GET /license/verify/:code` | público | público | público |
| `POST /license/create` | - | - | sim |
| `GET /license/health` | - | sim | sim |
| `GET /license/all` | - | sim | sim |
| `GET /license/searchByStudent/:studentId` | - | sim | sim |
| `GET /license/me` | sim | - | - |
| `GET /license/:id` | - | sim | sim |
| `PATCH /license/update/:id` | - | sim | sim |
| `PATCH /license/reject/:id` | - | sim | sim |
| `DELETE /license/delete/:id` | - | - | sim |

### Bus / University / Course / Employee

- CRUD administrativo usa `ADMIN`
- a listagem pública existe apenas onde o controller marcou `@Public()`
- rotas `inactive` existem separadas para não colidir com `:id`

## Notas sobre filas e privacidade

- `GET /bus/with-queue-counts` retorna contagens agregadas por ônibus e por `universitySlots` (campos como `pendingCount` e `waitlistedCount`). Esse endpoint NÃO deve expor dados pessoais (nome, email, CPF, telefone, cpfHash).
- `GET /bus/:id/queue-summary` retorna requests completas (inclui `studentId`) e deve ser restrito a `EMPLOYEE`/`ADMIN` — não usar para modais públicos que exibem apenas contagens.
- A regra de prioridade dinâmica (ver [docs/invariants.md](./invariants.md)) significa que o frontend deve confiar no backend para decidir quais universidades aparecem como aprováveis; o funcionário NÃO deve basear promoções em contagens locais sem checar a prioridade ativa retornada pelo backend.
