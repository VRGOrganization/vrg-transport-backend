# Scripts de verificação/instrumentação das invariantes

Esta pasta contém utilitários para verificar e simular as regras do domínio relacionadas a vagas, filas e promoções de `bus`/`license_request`.

Pré-requisitos
- Node.js
- Acesso a uma instância MongoDB compatível com os dados do backend (p.ex. `mongodb://localhost:27017/vrg-transport`)

Scripts
- `check_invariants.js` — conecta ao Mongo e gera um relatório JSON em `scripts/verify_invariants/report-<ts>.json` com anomalias encontradas.
  Uso:

  ```bash
  MONGO_URI="mongodb://localhost:27017/vrg-transport" node check_invariants.js
  ```

- `simulate_release.js` — simula (somente leitura) a lógica de promoção usada em `BusService.releaseSlotsForBus` e exibe quais `license_request` seriam promovidos.
  Uso:

  ```bash
  MONGO_URI="mongodb://localhost:27017/vrg-transport" node simulate_release.js --busId=<busId> --quantity=3
  ```

Observações
- Os scripts usam modelos Mongoose mínimos (somente os campos necessários) e NÃO alteram o banco.
- Para executar a promoção real use a API admin `PATCH /bus/:id/release-slots` com credenciais apropriadas — estes scripts servem para diagnóstico e testes locais.
