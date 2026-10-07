# T-72 — Minha conta (backend)

* **Fase:** 3 — API do backend
* **Depende de:** T-70
* **Status:** Concluída

## Objetivo

Editar perfil, trocar senha e excluir conta.

## Documentos fonte

* `docs/decisions/business-decisions.md` (PD-41)
* `docs/specs/auth.md` §8

## Escopo

* `PUT /api/auth/me` (nome e username).
* `POST /api/auth/me/password` (senha atual; encerra as outras sessões).
* `DELETE /api/auth/me` (senha atual; apaga todos os dados do usuário).
* Código `INVALID_CURRENT_PASSWORD`.

## Fora de escopo

* Recuperação de senha; alteração de email.

## Critérios de aceite

* CA-AUTH-12, CA-AUTH-13, CA-AUTH-14.

## Testes obrigatórios

* Casos de sucesso e erro de cada rota em `auth.int.spec.ts`; exclusão não afeta outro usuário.

## Regras para o agente

* Implemente **somente** o escopo desta task.
* As regras de negócio vêm exclusivamente dos documentos fonte listados. Não invente regras.
* Se encontrar ambiguidade ou contradição nos documentos, **interrompa** aquela parte, descreva a dúvida e peça definição (`architecture.md` §24).
* Valores monetários sempre em centavos inteiros.

## Definição de pronto

* Critérios de aceite atendidos.
* Testes obrigatórios escritos e passando.
* Build sem erros.
* Nenhuma regra de negócio nova ou divergente da documentação.

## Decisões técnicas registradas

* `account.service.ts`: `updateProfile` (unicidade do username ignorando o próprio usuário), `changePassword` (atualiza o hash e apaga as sessões `≠` da atual numa transação) e `deleteAccount`.
* Exclusão com o cliente restrito ao usuário, sob o lock exclusivo dos meses dele, na ordem: alocações → estornos → parcelas → exceções → (zera crédito transferido) → lançamentos → planos → faturas → recorrências → cartões → métodos → categorias → meses → marca d'água → sessões → usuário.
* `INVALID_CURRENT_PASSWORD` (422). O limite de tentativas também cobre trocar senha e excluir conta (as falhas contam junto com login/cadastro); documentado em `auth.md` §6 e `architecture.md` §22.
