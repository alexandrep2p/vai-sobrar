# T-22 — Compra à vista no cartão

* **Fase:** 3 — API
* **Depende de:** T-06, T-19, T-21
* **Status:** Concluída

## Objetivo

Registrar compras à vista no cartão com postagem na fatura correta.

## Documentos fonte

* `docs/specs/credit-cards.md` — §7–§11
* `docs/specs/invoices.md` — §4
* `docs/specs/transactions.md` — §10, §12

## Escopo

* Criação com `purchase_date` (janela: mês corrente até hoje, ou futura), cartão ativo, categoria ativa.
* Postagem via `postingInvoice` (compra retroativa e compra tardia), criação da fatura quando necessário, `financial_month` e `due_date` derivados.
* Edição permitida pela matriz (descrição e categoria enquanto a fatura não estiver `PAID`); valor, cartão e `purchase_date` imutáveis.
* Rejeitar exclusão e pagamento individual (`CARD_TRANSACTION_SETTLED_BY_INVOICE`).

## Fora de escopo

* Transição automática de status (T-23).
* Parcelamento (T-26).

## Critérios de aceite

* CA-CAR-02, CA-CAR-04, CA-CAR-05, CA-CAR-08, CA-CAR-09, CA-CAR-11, CA-CAR-12, CA-CAR-13, CA-CAR-15, CA-CAR-16, CA-FAT-01, CA-FAT-02.

## Testes obrigatórios

* Testes de API dos critérios, incluindo compra tardia e criação de fatura `CLOSED`.

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

* Postagem via `postingInvoice` dentro de transação com o lock do cartão; a fatura é criada com `INSERT ... ON CONFLICT DO NOTHING` (idempotente sob concorrência). Sem `purchase_date` → `INVALID_PURCHASE_DATE`; cartão inativo → `CARD_INACTIVE`.
