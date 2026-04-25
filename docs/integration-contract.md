# Contrato de Integração

Este documento resume as regras práticas que front e API precisam compartilhar para evitar contratos implícitos.

## 1. Inscrição inicial do estudante

O front envia o formulário multipart de `POST /student/me/license-submit` com:

- `institution`
- `degree`
- `shift`
- `bloodType`
- `schedule`
- `ProfilePhoto`
- `EnrollmentProof`
- `CourseSchedule`

O backend:

- atualiza perfil e imagens
- decide o ônibus com base na faculdade e no turno
- grava a request com `busId`, `universityId`, `cardNote` e `accessBusIdentifiers`

## 2. Regra do aluno integral

Se o estudante estiver em `Integral`:

- o backend tenta direcionar para o ônibus da `Manhã`
- a request recebe uma anotação dizendo que o aluno é integral
- a anotação também registra acesso aos ônibus da faculdade para a carteirinha

## 3. Ônibus

O cadastro de ônibus passou a ter `shift` principal.

Valores aceitos:

- `Manhã`
- `Tarde`
- `Noite`

O front administrativo pode exibir esse campo, mas não deve usá-lo para reinventar a regra de roteamento.

## 4. Carteirinha

A emissão usa o contexto da request.

Campos importantes:

- `cardNote`
- `accessBusIdentifiers`
- `busId`
- `universityId`

## 5. Atualização de carteirinha

`PATCH /license/update/:id` recebe o `id` na rota.
O body deve ser parcial e não exigir `id`.

## 6. O que evitar

- escolher ônibus manualmente na inscrição inicial
- assumir que `waitlisted` é erro
- duplicar a política de senha em locais diferentes
- criar um contrato diferente entre cadastro e reset de senha
