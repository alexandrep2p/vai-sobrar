# T-60 — Registrar a PD-40 (contas e dados por usuário)

* **Fase:** 0 — Base técnica
* **Depende de:** —
* **Status:** Concluída

## Objetivo

Registrar a decisão de contas de usuário e isolamento dos dados e propagá-la para a documentação normativa.

## Documentos fonte

* `docs/decisions/business-decisions.md`

## Escopo

* PD-40 em `business-decisions.md`; PD-22 marcada como substituída; nota na PD-38.
* Nova spec `docs/specs/auth.md`.
* Ajustes em `prd.md` (§3, §4.3, §15), `domain-model.md` (§2, §3.13, invariante 15, §7), `architecture.md` (§7, §12, §18.0, §20, §22, §23, §25, §27), `categories.md` e `payment-methods.md` (unicidade por usuário, métodos do sistema por conta).
* Tasks T-60..T-68.

## Fora de escopo

* Implementação.

## Critérios de aceite

* Nenhuma referência restante a "single-user" como regra vigente.

## Testes obrigatórios

* Não se aplica (documentação).

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

* A escolha de sessão em cookie (`architecture.md` §22) foi feita com o usuário durante o planejamento.
