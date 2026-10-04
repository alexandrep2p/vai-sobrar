# T-14 — Domínio: regras de edição e imutabilidade

* **Fase:** 1 — Domínio puro
* **Depende de:** T-08
* **Status:** Concluída

## Objetivo

Implementar as guardas que dizem se um campo de um lançamento pode ser alterado e se uma operação pode atingir um mês ou fatura.

## Documentos fonte

* `docs/specs/transactions.md` — §7, §9, §11, §12, §13
* `docs/specs/invoices.md` — §5.1
* `docs/specs/financial-periods.md` — §5
* `docs/specs/installments.md` — §9

## Escopo

* Matriz de edição por origem e campo, incluindo as notas ¹ (fatura `PAID`) e ² (parcelamento).
* Status: reversível só para método comum; cartão só via pagamento de fatura.
* Troca de método somente entre métodos comuns.
* Exclusão por origem.
* Barreira de mês fechado e de fatura `PAID`.

## Fora de escopo

* Casos de uso que aplicam as guardas (Fase 3).

## Critérios de aceite

* CA-TRA-13, CA-TRA-15, CA-TRA-16, CA-TRA-17, CA-TRA-19, CA-TRA-20, CA-TRA-21, CA-FAT-19, CA-PAR-09.

## Testes obrigatórios

* Cada célula da matriz de edição.
* Mês fechado bloqueia tudo.
* Fatura `PAID` bloqueia todos os campos.

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

* Retorno `Verdict` (`allowed` ou `code`) + `assertAllowed` para lançar `BusinessError`. Códigos escolhidos (a spec não mapeia): mês fechado → `PERIOD_CLOSED`; fatura `PAID` → `INVOICE_ALREADY_PAID`; célula "não" → `TRANSACTION_NOT_EDITABLE`; status de cartão → `CARD_TRANSACTION_SETTLED_BY_INVOICE`; plano com parcela em mês fechado/fatura paga → `INVALID_INSTALLMENT_OPERATION`; exclusão fora de `MANUAL` → `TRANSACTION_NOT_DELETABLE`; troca de método comum↔cartão → `TRANSACTION_NOT_EDITABLE`; crédito em fatura `CLOSED` → `INVOICE_NOT_OPEN_FOR_CREDIT`.
* Precedência: mês fechado → fatura `PAID` (lançamentos de cartão) → matriz. Validação de tipo/atividade da categoria e do método fica nos casos de uso. Código em `src/domain/edit-guards.ts`.
