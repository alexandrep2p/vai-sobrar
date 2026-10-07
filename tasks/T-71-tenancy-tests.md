# T-71 — Testes de isolamento entre usuários

* **Fase:** 5 — Validação transversal
* **Depende de:** T-70
* **Status:** Concluída

## Objetivo

Provar que um usuário não vê, altera nem referencia dados de outro.

## Documentos fonte

* `docs/decisions/business-decisions.md` (PD-41)
* `docs/specs/auth.md`

## Escopo

* `tests/api/tenancy.int.spec.ts` com usuários A e B em todas as entidades, fechamento de mês, extrato e geração de ocorrências.
* `tests/integration/tenant-scope.int.spec.ts` para a extensão de escopo.
* Constraints de unicidade por usuário.

## Fora de escopo

* Mudanças de regra.

## Critérios de aceite

* CA-AUTH-09, CA-AUTH-10.

## Testes obrigatórios

* Os arquivos do escopo.

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

* `tests/api/tenancy.int.spec.ts` (9 testes): listas, extrato, consultas, alterações, pagamentos, exclusões e referências cruzadas entre A e B; nomes e meses por usuário; geração de ocorrências e marca d'água por usuário; rotina periódica para todos.
* `tests/integration/tenant-scope.int.spec.ts` (13 testes): injeção por operação, `$transaction`, `upsert` composto, falha fechada, constraints por usuário e de `users`.
* Verificação por mutação: removendo o `userId` do filtro da extensão, os 9 testes de isolamento falham.
