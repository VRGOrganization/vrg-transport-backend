# Autenticação

## Visão Geral

A API usa JWT com dois tokens:

| Token | Uso | Chave de assinatura | Payload adicional |
|---|---|---|---|
| **Access Token** | Autorizar requisições (`Authorization: Bearer`) | `JWT_SECRET` | `sub`, `role`, `identifier`, `tokenUse: 'access'` |
| **Refresh Token** | Obter novo par de tokens | `JWT_REFRESH_SECRET` | `sub`, `role`, `identifier`, `tokenUse: 'refresh'`, `tokenVersion` |

---

## Fluxo de Registro de Estudante (com OTP)

```
1. POST /api/v1/auth/student/register
   Body: { name, email, password, telephone }
   ─ Valida campos (email único, senha forte)
   ─ Verifica se o domínio do e-mail é institucional (edu.br, ac.br, usp.br…)
   ─ Hash da senha com bcrypt (12 rounds)
   ─ Gera código OTP de 6 dígitos
   ─ Hash do OTP com HMAC-SHA256 + pepper (OTP_PEPPER)
   ─ Persiste estudante com status PENDING
   ─ Envia e-mail com o código OTP
   ← 201 { message: string, isInstitutional: boolean }

2. POST /api/v1/auth/student/verify
   Body: { email, code }
   ─ Busca estudante pelo e-mail
   ─ Verifica se a conta está bloqueada (verificationCodeLockedUntil)
   ─ Verifica se o código não expirou (expira em 15 minutos)
   ─ Compara o código com timing-safe comparison (evita timing attacks)
   ─ Se inválido: incrementa tentativas; após 5 falhas, bloqueia por 60 segundos
   ─ Se válido: ativa a conta (status → ACTIVE), limpa campos OTP
   ─ Emite par de tokens (access + refresh)
   ← 200 LoginResponse

3. (Opcional) POST /api/v1/auth/student/resend-code
   Body: { email }
   ─ Verifica cooldown (60 segundos entre reenvios)
   ─ Gera novo OTP, invalida o anterior
   ─ Reenvia e-mail
   ← 200 { message: string }
```

---

## Fluxo de Login por Perfil

Cada perfil tem credenciais diferentes:

| Perfil | Endpoint | Credenciais |
|---|---|---|
| Estudante | `POST /auth/student/login` | `email` + `password` |
| Funcionário | `POST /auth/employee/login` | `registrationId` + `password` |
| Admin | `POST /auth/admin/login` | `username` + `password` |

Todos retornam o mesmo formato `LoginResponse`:

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": {
    "id": "64f3a...",
    "role": "student",
    "identifier": "usuario@email.com"
  }
}
```

> O estudante precisa ter status `ACTIVE` (e-mail verificado) para conseguir fazer login.

---

## Rotação de Refresh Token

O refresh token é projetado para uso único:

```
1. POST /api/v1/auth/refresh
   Body: { refresh_token: "eyJ..." }

   ─ Valida assinatura com JWT_REFRESH_SECRET
   ─ Confirma tokenUse === 'refresh'
   ─ Busca sessão no banco pelo sub (userId)
   ─ Compara hash bcrypt do token recebido com o hash armazenado
   ─ Compara tokenVersion do payload com refreshTokenVersion no banco
     → Se versões divergem: token foi reutilizado → revoga sessão → 401
   ─ Incrementa refreshTokenVersion
   ─ Gera novo par de tokens com a nova versão
   ─ Hash do novo refresh token salvo no banco
   ← 200 LoginResponse
```

---

## Logout

```
POST /api/v1/auth/logout
Authorization: Bearer <access_token>

─ Lê o usuário do JWT (sub + role)
─ Invalida o refresh token no banco (refreshTokenHash = null, refreshTokenVersion++)
← 200 { message: string }
```

---

## Usando o Bearer Token

Inclua o `access_token` em todas as requisições autenticadas:

```bash
curl -H "Authorization: Bearer eyJ..." \
  https://api.vrgtransport.com.br/api/v1/student/me
```

Quando o access token expirar, use o refresh token para obter um novo par:

```bash
curl -X POST https://api.vrgtransport.com.br/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "eyJ..."}'
```

---

## Política de Rate Limiting

| Endpoint | Limite | Janela | keyPrefix |
|---|---|---|---|
| `POST /auth/student/register` | 3 requisições | 60 segundos | `register` |
| `POST /auth/student/verify` | 5 requisições | 60 segundos | `verify` |
| `POST /auth/student/resend-code` | 3 requisições | 60 segundos | `resend` |
| `POST /auth/student/login` | 5 requisições | 60 segundos | `login` |
| `POST /auth/employee/login` | 5 requisições | 60 segundos | `login` |
| `POST /auth/admin/login` | 3 requisições | 60 segundos | `login` |
| `POST /auth/refresh` | 10 requisições | 60 segundos | `refresh` |

O rate limiting é por IP. Configure `TRUST_PROXY_HOPS` corretamente se a API estiver atrás de um proxy reverso.

Ao atingir o limite: `429 Too Many Requests`.

---

## Bloqueio por Tentativas de OTP

Independente do rate limiting de endpoint, o serviço rastreia tentativas de verificação por conta:

| Condição | Ação |
|---|---|
| Código inválido | Incrementa `verificationCodeAttempts` |
| 5 tentativas inválidas | Bloqueia a conta por 60 segundos (`verificationCodeLockedUntil`) |
| Código expirado (> 15 min) | Retorna erro, sugere reenvio |
| Conta bloqueada | Retorna erro até o tempo de bloqueio passar |

---

## Domínios Institucionais

Ao registrar, a API verifica se o domínio do e-mail pertence a uma lista de domínios educacionais reconhecidos:

```
edu.br, ac.br, usp.br, unicamp.br, ufrj.br, unifesp.br
```

O campo `isInstitutional` na resposta do registro informa se o e-mail foi reconhecido como institucional. Isso não altera o fluxo de verificação, mas pode influenciar regras de negócio futuras.
