# Autenticacao

## Visao Geral

A API usa autenticacao por sessao (session-first). O backend cria a sessao e retorna o `sessionId`. O BFF grava o cookie httpOnly `sid` no browser e envia o `sessionId` ao backend via header `x-session-id`.

Para o modulo de auth, o BFF tambem envia `x-service-secret` (segredo compartilhado entre BFF e backend). O backend nao escreve cookies e nao usa headers de token.

---

## Fluxo de Registro de Estudante (com OTP)

```
1. POST /api/v1/auth/student/register
   Body: { name, email, password, telephone }
   - Valida campos (email unico, senha forte)
   - Verifica se o dominio do e-mail e institucional (edu.br, ac.br, usp.br...)
   - Hash da senha com bcrypt (12 rounds)
   - Gera codigo OTP de 6 digitos
   - Hash do OTP com HMAC-SHA256 + pepper (OTP_PEPPER)
   - Persiste estudante com status PENDING
   - Envia e-mail com o codigo OTP
   <- 201 { message: string, isInstitutional: boolean }

2. POST /api/v1/auth/student/verify
   Body: { email, code }
   - Busca estudante pelo e-mail
   - Verifica se a conta esta bloqueada (verificationCodeLockedUntil)
   - Verifica se o codigo nao expirou (expira em 15 minutos)
   - Compara o codigo com timing-safe comparison (evita timing attacks)
   - Se invalido: incrementa tentativas; apos 5 falhas, bloqueia por 60 segundos
   - Se valido: ativa a conta (status -> ACTIVE), limpa campos OTP
   - Cria sessao
   <- 200 SessionAuthResponse

3. (Opcional) POST /api/v1/auth/student/resend-code
   Body: { email }
   - Verifica cooldown (60 segundos entre reenvios)
   - Gera novo OTP, invalida o anterior
   - Reenvia e-mail
   <- 200 { message: string }
```

### SessionAuthResponse

```json
{
  "ok": true,
  "sessionId": "507f1f77bcf86cd799439011",
  "user": {
    "id": "64f3a...",
    "role": "student",
    "identifier": "usuario@email.com",
    "name": "Maria Silva"
  }
}
```

> O BFF recebe o `sessionId`, grava o cookie `sid` e passa o header `x-session-id` nas chamadas seguintes.

---

## Fluxo de Login por Perfil

Cada perfil tem credenciais diferentes:

| Perfil | Endpoint | Credenciais |
|---|---|---|
| Estudante | `POST /auth/student/login` | `email` + `password` |
| Funcionario | `POST /auth/employee/login` | `registrationId` + `password` |
| Admin | `POST /auth/admin/login` | `username` + `password` |

Todos retornam `SessionAuthResponse`.

---

## Logout

```
POST /api/v1/auth/logout
Header: x-service-secret: <segredo>
Header (opcional): x-session-id: <sessionId>

- Revoga a sessao se existir
- Sempre retorna sucesso (idempotente)
<- 200 { ok: true }
```

---

## Como Autenticar Requisicoes

Chamadas do browser devem ir para o BFF. O backend espera headers enviados pelo BFF:

```
Header: x-session-id: <sessionId>
```

Para endpoints do modulo Auth, sempre incluir tambem:

```
Header: x-service-secret: <segredo>
```

---

## Politica de Rate Limiting

| Endpoint | Limite | Janela | keyPrefix |
|---|---|---|---|
| `POST /auth/student/register` | 3 requisicoes | 60 segundos | `register` |
| `POST /auth/student/verify` | 5 requisicoes | 60 segundos | `verify` |
| `POST /auth/student/resend-code` | 3 requisicoes | 60 segundos | `resend` |
| `POST /auth/student/login` | 5 requisicoes | 60 segundos | `login` |
| `POST /auth/employee/login` | 5 requisicoes | 60 segundos | `login` |
| `POST /auth/admin/login` | 3 requisicoes | 60 segundos | `login` |

O rate limiting e por IP. Configure `TRUST_PROXY_HOPS` corretamente se a API estiver atras de um proxy reverso.

Ao atingir o limite: `429 Too Many Requests`.

---

## Bloqueio por Tentativas de OTP

Independente do rate limiting de endpoint, o servico rastreia tentativas de verificacao por conta:

| Condicao | Acao |
|---|---|
| Codigo invalido | Incrementa `verificationCodeAttempts` |
| 5 tentativas invalidas | Bloqueia a conta por 60 segundos (`verificationCodeLockedUntil`) |
| Codigo expirado (> 15 min) | Retorna erro, sugere reenvio |
| Conta bloqueada | Retorna erro ate o tempo de bloqueio passar |

---

## Dominios Institucionais

Ao registrar, a API verifica se o dominio do e-mail pertence a uma lista de dominios educacionais reconhecidos:

```
edu.br, ac.br, usp.br, unicamp.br, ufrj.br, unifesp.br
```

O campo `isInstitutional` na resposta do registro informa se o e-mail foi reconhecido como institucional. Isso nao altera o fluxo de verificacao, mas pode influenciar regras de negocio futuras.
