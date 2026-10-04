# T-21 — Lançamentos manuais

* **Fase:** 3 — API
* **Depende de:** T-14, T-17, T-18, T-20
* **Status:** Concluída

## Objetivo

Implementar criação, edição, pagamento, alteração de vencimento e exclusão de lançamentos com método comum.

## Documentos fonte

* `docs/specs/transactions.md`
* `docs/specs/financial-periods.md` — §3, §5
* `docs/architecture/architecture.md` — §18.5

## Escopo

* Criar (validações, natureza pela categoria, janela retroativa, mês fechado).
* Editar conforme a matriz (T-14), inclusive mover vencimento entre meses abertos.
* Pagar (`paid_at` ≤ hoje, fora de mês fechado) e desfazer.
* Excluir somente `MANUAL` em mês aberto.
* Listar e detalhar.
* Rejeitar método de cartão neste fluxo (compras de cartão são da T-22).

## Fora de escopo

* Compras de cartão, parcelas e ocorrências.

## Critérios de aceite

* CA-TRA-01 a CA-TRA-14, CA-TRA-17, CA-TRA-18.
* CA-CAT-12 e CA-MET-12 (categoria e método de lançamento de mês fechado não podem ser alterados).

## Testes obrigatórios

* Testes de API para cada critério.

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

* `POST /api/transactions` é o ponto único de criação: método comum → lançamento manual (`due_date`); método de cartão → compra à vista (`purchase_date`); `installment_count >= 2` → parcelado. Campo opcional `type` (natureza esperada) → `CATEGORY_TYPE_MISMATCH` se divergir da categoria (CA-TRA-03).
* Janela retroativa de lançamento manual por `due_date` (código novo `INVALID_DUE_DATE`); `paid_at` futuro ou em mês fechado → `INVALID_PAYMENT_DATE`. Pagar lançamento já pago, ou desfazer um já pendente, → `TRANSACTION_NOT_EDITABLE`. `DELETE` responde 204.
* Edição por campos alterados: só campos cujo valor realmente muda passam pelas guardas da matriz (domain/edit-guards).
