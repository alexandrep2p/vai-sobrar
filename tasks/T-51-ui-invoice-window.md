# T-51 — Janela padrão da lista de faturas

* **Fase:** 4 — Frontend
* **Depende de:** T-42
* **Status:** Concluída

## Objetivo

Abrir a lista de faturas no mês atual e nos 11 meses seguintes (PD-33).

## Documentos fonte

* `docs/decisions/business-decisions.md` (PD-33)

## Escopo

* `invoices.page.ts`: `MONTHS_BEFORE = 0` e `MONTHS_AFTER = 11`.
* Atualizar a nota de decisão técnica da T-42.

## Fora de escopo

* Qualquer regra não descrita nos documentos fonte.

## Critérios de aceite

* Com hoje em 04/10/2026, a lista abre de 10/2026 a 09/2027; "De" e "Até" continuam editáveis.

## Testes obrigatórios

* Ajustar `invoices.spec.ts` com relógio fixo.

## Regras para o agente

* Implemente **somente** o escopo desta task.
* As regras de negócio vêm exclusivamente dos documentos fonte listados. Não invente regras.
* Se encontrar ambiguidade ou contradição nos documentos, **interrompa** aquela parte, descreva a dúvida e peça definição (`architecture.md` §24).
* Regras de cálculo ficam nas funções de domínio centralizadas (`architecture.md` §9); não as reimplemente em controllers, repositories ou no frontend.
* Valores monetários sempre em centavos inteiros.
* Datas que dependem de "hoje" usam o relógio injetável (T-04), para permitir testes determinísticos.

## Definição de pronto

* Critérios de aceite atendidos.
* Testes obrigatórios escritos e passando (`npm test`).
* Build sem erros (`npm run build`).
* Nenhuma regra de negócio nova ou divergente da documentação.
* Se uma decisão técnica foi tomada nesta task, ela está registrada na seção "Decisões técnicas registradas" deste arquivo.

## Decisões técnicas registradas

* `MONTHS_BEFORE = 0` e `MONTHS_AFTER = 11` em `invoices.page.ts`; a nota de padrão da T-42 foi atualizada.
