# Invariantes do sistema

Estas invariantes são garantias que o backend mantém e que o frontend/tests devem respeitar e validar.

1. `LicenseRequest.busId` nunca é nulo em pedidos criados após esta feature.
2. `LicenseRequest.universityId` nunca é nulo em pedidos criados após esta feature.
3. `Bus.universitySlots[i].filledSlots >= 0` sempre.
4. `sum(bus.universitySlots[].filledSlots) <= bus.capacity` quando `capacity` definida.
5. `priorityOrder` único dentro de `bus.universitySlots` do mesmo ônibus.
6. Aluno com `PENDING` ou `WAITLISTED` ativo não pode criar outro pedido no mesmo período.
7. `GET /bus/with-queue-counts` e `PATCH /bus/:id/release-slots` nunca retornam `name`, `email`, `cpf`, `telephone` ou `cpfHash` de alunos.
8. Funcionário não escolhe o ônibus na aprovação — vem de `LicenseRequest.busId`.
9. `Bus.identifier` é o campo `bus` na carteirinha impressa.
10. Ao fechar `EnrollmentPeriod`, todos os `filledSlots` de todos os ônibus ativos são zerados.
11. `Student.secondaryBusId` é definido apenas manualmente pelo admin — `createRequest` nunca o usa.
12. `EnrollmentPeriod.totalSlots` nunca pode ser menor que `sum(bus.capacity)` dos ônibus ativos com `capacity` definida.
13. Regra de prioridade dinâmica: enquanto a universidade P1 tiver qualquer demanda ativa (PENDING ou WAITLISTED), P2 não pode ser aprovada, promovida ou exibida como selecionável no frontend.

> Observação: os testes E2E e de concorrência devem ser capazes de detectar regressões nessas invariantes. O backend aplica validações e lógica nas camadas de `LicenseRequestService`, `LicenseRequestRepository` e `BusService` para manter essas garantias.
