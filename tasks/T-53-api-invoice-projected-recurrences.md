# T-53 — Fatura com ocorrências projetadas e pagamento

* **Fase:** 3 — API do backend
* **Depende de:** T-24, T-25, T-29, T-30
* **Status:** Concluída

## Objetivo

Incluir ocorrências projetadas de recorrência no detalhe e total da fatura e gerá-las ao pagar (PD-35).

## Documentos fonte

* `docs/decisions/business-decisions.md` (PD-35)
* `docs/specs/invoices.md` §4, §7, §9
* `docs/specs/recurrences.md` §6, §13

## Escopo

* `buildInvoiceDetail` e `listCardInvoices` incluem `projectOccurrences` do cartão no ciclo, marcadas como previstas, com `projected_total` separado e total somado.
* Ciclo sem fatura persistida com projeção passa a ter detalhe.
* Pagamento: gera as ocorrências projetadas (compras `RECURRENCE`) e as liquida na mesma transação; sem duplicar na geração posterior (unicidade `recurrence_id + occurrence_month`).
* Respeitar pausa, cancelamento, exceções, método/categoria/cartão inativos; fatura `PAID` não recebe previsão.

## Fora de escopo

* Qualquer regra não descrita nos documentos fonte.

## Critérios de aceite

* CA-FAT-16, CA-FAT-16A e CA-FAT-16B.

## Testes obrigatórios

* Testes de integração em `backend/tests/api/`: detalhe com previsto, pagar gera e liquida, não duplica, pulada/pausada não aparece, concorrência com a geração por data.

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

* `projectOccurrences` ganhou o filtro `cardId`. `projected_total` e `projected_items` em fatura (lista e detalhe); `totals.debits`/`amount_due` já incluem a previsão. Novo `GET /api/credit-cards/:id/invoices/:month` para o detalhe do ciclo sem fatura persistida.
* Pagamento: antes de liquidar, gera as ocorrências previstas (`generateOccurrenceInTx` com `allowFuture`) e as liquida junto. Ordem de locks igual à da geração por data (recorrências ordenadas por id → cartão) para evitar impasse.
* Limitação registrada: ciclo sem fatura persistida mostra a previsão, mas só pode ser pago depois de existir fatura (há ao menos um lançamento).
