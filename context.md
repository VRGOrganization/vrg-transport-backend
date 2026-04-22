# Contexto e Plano: Integração License API

Objetivo

Alinhar o contrato entre o `vrg-transport-backend` (NestJS) e a `vrg-transport-license-api` (FastAPI) e definir um plano em etapas para corrigir as incoformidades detectadas.

Resumo das incoformidades identificadas

- Health: o backend chama `GET {LICENSE_API_URL}/health` e faz `res.json()` (espera JSON), enquanto a License API retorna um `Response` vazio em [vrg-transport-license-api/app/routes/health.py]. Isso causa erro de parse em [vrg-transport-backend/src/license/license.service.ts].
- Limites de foto inconsistentes: DTO do backend permite ~2_000_000 chars; o backend também valida até 5MB; a License API valida `MAX_PHOTO_BASE64_BYTES = 2_097_152` e o `main` limita o body a ~3 MB. Precisamos unificar um limite único.
- Campos extras no payload: o backend envia `card_note` e `access_bus_identifiers` no payload para a License API, mas o schema pydantic não declara esses campos — serão ignorados.
- Tratamento de erros: License API usa `AppError` com `{code, status}`; o backend transforma qualquer 4xx/5xx em `BadGateway` sem mapear códigos específicos e sem preservar o `code` retornado.
- Rate limit: License API aplica `20/minute` por IP; o backend faz chamadas pelo mesmo IP e pode sofrer `429`.
-- Variáveis de ambiente / chaves: o nome preferido agora é `LICENSE_API_KEY`. A License API aceita `LICENSE_API_KEY` e mantém `API_KEY` por compatibilidade.

Impacto

- Falha no health-check automático do backend.
- Erros pouco informativos (502) quando a License API responde com 4xx específicos.
- Perda de dados opcionais se decidir não estender o schema da License API.
- Risco de disponibilidade por hits de rate limit.

Plano por etapas

Fase 1 — Correções rápidas (alto impacto / baixo risco)

1. Criar este `context.md` (feito).
2. Corrigir health-check:
   - Opção A (recomendada): fazer a License API retornar JSON simples em `/health` (ex: `{ "status": "ok" }` e `{ "status": "mongo_unavailable" }` para 503).
   - Opção B: alterar o backend para checar `response.ok` antes de `res.json()` — menos invasivo no serviço externo.
3. Unificar limite de foto: definir um valor único (recomendado: 2_097_152 bytes base64 ≈ 2 MB) e aplicar em:
   - `vrg-transport-backend/src/license/dto/create-license.dto.ts`
   - `vrg-transport-backend/src/license/license.service.ts` (normalização/validação)
   - `vrg-transport-license-api/app/schemas/license_payload.py` e `app/services/fill_license.py`.
4. Mapear erros HTTP do License API no backend, preservando `code` quando presente e convertendo 400/403/413/429 em exceções apropriadas.
5. Decidir payload extras: (a) remover `card_note` / `access_bus_identifiers` do payload enviado, ou (b) estender o schema da License API para aceitar estes campos opcionais. Documentar a decisão.

Atualizações aplicadas (22/04/2026)

- `Health`: a rota `/health` da License API agora retorna JSON (`{"status":"ok""}` ou `{"status":"mongo_unavailable"}`) para compatibilidade com o backend.
- `Formato de retorno`: a License API passou a retornar a carteirinha como `multipart/form-data` com um único campo `image` (arquivo JPEG). O backend foi atualizado para parsear respostas multipart e converter o conteúdo do campo `image` para Base64 antes de armazenar em `imageLicense`.
- `Limite de foto`: unificado para 2_097_152 caracteres (≈2 MB em base64). Ajustado em:
  - Backend DTO: `src/license/dto/create-license.dto.ts`
  - Backend service: `src/license/license.service.ts`
  - License API schema: `app/schemas/license_payload.py`
- Campos adicionais: adicionados `card_note`, `access_bus_identifiers` e `study_schedule` ao payload da License API; o backend agora injeta esses campos no payload enviado.
  - `study_schedule` é construído no backend a partir do `student.schedule` (campo do documento `Student`) e normalizado para strings legíveis: exemplo `"Terça Manhã"`, `"Quinta Integral"` (quando há >1 período no mesmo dia).
- Mapeamento de erros: o backend agora analisa respostas não-OK da License API, tenta extrair JSON com `code/message` e mapeia status HTTP conhecidos (400,401,403,413,429) para exceções específicas, preservando mensagens quando possível.

Arquivos alterados (resumo)

- License API
  - [app/routes/health.py](vrg-transport-license-api/app/routes/health.py)
  - [app/routes/license.py](vrg-transport-license-api/app/routes/license.py)
  - [app/schemas/license_payload.py](vrg-transport-license-api/app/schemas/license_payload.py)

- Backend
  - [src/license/license.service.ts](vrg-transport-backend/src/license/license.service.ts)
  - [src/license/dto/create-license.dto.ts](vrg-transport-backend/src/license/dto/create-license.dto.ts)

Observações importantes

- O novo retorno `multipart/form-data` reduz o peso da resposta JSON (evita string base64 longa no corpo JSON). O backend reconstrói base64 internamente para persistência; os consumidores que dependem do antigo JSON devem ser atualizados.
- A License API ainda aplica rate limiting (`20/minute` por IP). Chamadas do backend podem gerar `429`; o backend já mapeia esse status para uma exceção `TooManyRequests` — considere implementar retry com backoff e circuit-breaker em Fase 2.
- Verifique variáveis de ambiente e nomes de chave: a License API usa `API_KEY`, o backend usa `LICENSE_API_KEY` — é necessário sincronizar valores no ambiente de deploy.

Próximos passos recomendados

1. Sincronizar variáveis de ambiente e atualizar `.env.example` em ambos os repositórios.
2. Atualizar documentação pública da API (docs/api-reference) com o novo contrato multipart e os campos `card_note`, `access_bus_identifiers`, `study_schedule`.
3. Implementar retry/backoff e instrumentação para 429/timeout no backend (`callLicenseApi`).
4. Adicionar testes de integração cobrindo:
   - health-check (`/health`) parseado pelo backend;
   - criação de carteirinha retornando multipart e persistência em base64;
   - payloads com `study_schedule` e `card_note`.
5. Revisar template da carteirinha se desejar que `card_note` ou `study_schedule` sejam impressos na imagem.

Como testar localmente

- Subir a License API (porta 4001):

  PowerShell:
  ```powershell
  cd vrg-transport-license-api
  python -m venv .venv
  .venv\Scripts\Activate.ps1
  pip install -r requirements.txt
  uvicorn app.main:app --reload --port 4001
  ```

- Teste manual do endpoint de criação (exemplo):

  ```bash
  curl -v -X POST http://localhost:4001/api/v1/license/create \
    -H "Content-Type: application/json" \
    -H "X-Api-Key: $API_KEY" \
    -d '{"id":"<studentId>","institution":"UFPE","bus":"205","photo":null}'
  ```

- Rodar testes do backend:

  ```bash
  cd vrg-transport-backend
  npm test
  ```

Decisões pendentes

- Definir se `card_note` e `study_schedule` devem aparecer visualmente na carteirinha (template) — caso afirmativo, atualizar `app/services/fill_license.py` para renderizar esses campos.
- Ajustar política de retries/limites para evitar atingir o rate limit quando o backend realiza muitas chamadas.

Se quiser, eu posso:
- abrir um PR com estas mudanças e preparar a descrição;
- implementar retry/backoff no `callLicenseApi`;
- atualizar `.env.example` em ambos os repositórios.

Fase 2 — Harden e testes (médio esforço)

1. Implementar retry/backoff e tratamento de timeout no `callLicenseApi` (circuit-breaker opcional).
2. Tratar 429 explicitamente: retries com backoff expondo métricas e logs.
3. Adicionar testes de integração / e2e cobrindo fluxo de criação de carteirinha e health-check.

Fase 3 — Operação e documentação (contínuo)

1. Sincronizar variáveis de ambiente e `.env.example` em ambos os serviços (garantir que o valor secreto usado em deploy seja o mesmo).
2. Adicionar monitoramento (contagem de 429, latência, erros 4xx/5xx) e alertas.
3. Atualizar documentação (README, API reference) com contrato definitivo e limites.

Critérios de aceitação (por tarefa)

- Health: `license.service.checkHealth()` não gera erro de parse e retorna resultado claro.
- Criação: chamadas a `/api/v1/license/create` retornam JSON com `image` base64, armazenado corretamente no backend.
- Limite de foto: payloads acima do limite são rejeitados antes de chamar o serviço externo; License API retorna 413/ERR002 quando aplicável.
- Erros: backend preserva e loga `code` do erro quando retornado pela License API e converte status adequadamente.
- Rate limit: 429s são tratados (logs e retries controlados) e instrumentados.

Comandos úteis (teste local)

- Rodar License API (exemplo):

  PowerShell:
  ```powershell
  cd vrg-transport-license-api
  python -m venv .venv
  .venv\Scripts\Activate.ps1
  pip install -r requirements.txt
  uvicorn app.main:app --reload --port 4001
  ```

- Verificar health:
  ```bash
  curl -v http://localhost:4001/health
  ```

- Testar criação (exemplo):
  ```bash
  curl -X POST http://localhost:4001/api/v1/license/create \
    -H "Content-Type: application/json" \
    -H "X-Api-Key: $API_KEY" \
    -d '{"id":"<studentId>","institution":"UFPE","bus":"205","photo":null}'
  ```

- Rodar testes backend:
  ```bash
  cd vrg-transport-backend
  npm test
  ```

Checklist para PRs

- Atualizar `.env.example` com as chaves e timeouts alinhados.
- Atualizar docs (README / docs/api-reference).
- Adicionar testes unitários/integracao.
- Validar manualmente health e criação localmente.

Decisão recomendada (prioridade)

1. Implementar Fase 1 imediatamente (health, limites, mapeamento de erros).
2. Em seguida, Fase 2 (retries/backoff e testes).
3. Fase 3 como trabalho contínuo de operação.

Se desejar, posso abrir PRs com patches propostos para os itens de Fase 1. Indique quais mudanças você quer que eu faça primeiro (ex: ajustar `/health` na License API ou adaptar o backend `license.service.ts`).
