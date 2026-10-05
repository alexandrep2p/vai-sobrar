# T-58 — Apagar lançamentos e compras parceladas (frontend)

* **Fase:** 4 — Frontend
* **Depende de:** T-57, T-41
* **Status:** Concluída

## Objetivo

Oferecer "Apagar" no menu dos itens da Home conforme a PD-38.

## Documentos fonte

* `docs/decisions/business-decisions.md` (PD-38)
* `docs/specs/home.md` §7

## Escopo

* Menu: "Apagar" para manual, ocorrência gerada, compra de cartão e parcela (que apaga a compra parcelada inteira), exceto fatura `PAID`.
* Confirmação destrutiva com aviso de estornos e de compra parcelada inteira.

## Fora de escopo

* Usuários, papéis e auditoria: no futuro apagar será privilégio de super admin (PD-38). Não implementar permissões agora.
* Apagar categorias, métodos, cartões, recorrências, faturas ou meses.

## Critérios de aceite

* Compra/parcela em fatura paga não mostra "Apagar"; o backend continua sendo a autoridade.

## Testes obrigatórios

* `item-actions.spec.ts` (por origem e fatura paga) e `home.page.spec.ts` (confirmar/cancelar, plano, estornos).

## Regras para o agente

* Implemente **somente** o escopo desta task.
* As regras de negócio vêm exclusivamente dos documentos fonte listados. Não invente regras.
* Se encontrar ambiguidade ou contradição nos documentos, **interrompa** aquela parte, descreva a dúvida e peça definição (`architecture.md` §24).
* Regras de cálculo ficam nas funções de domínio centralizadas (`architecture.md` §9); não as reimplemente em controllers, repositories ou no frontend.
* Valores monetários sempre em centavos inteiros.

## Definição de pronto

* Critérios de aceite atendidos.
* Testes obrigatórios escritos e passando.
* Build sem erros.
* Nenhuma regra de negócio nova ou divergente da documentação.

## Decisões técnicas registradas

* `ledger.deletePlan` chama `DELETE /installment-plans/:id`; o texto da UI mudou de "Excluir" para "Apagar".
