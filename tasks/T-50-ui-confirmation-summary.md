# T-50 — Resumo de confirmação antes de gravar

* **Fase:** 4 — Frontend
* **Depende de:** T-48, T-49
* **Status:** Concluída

## Objetivo

Exibir um resumo com "Voltar" e "Confirmar" antes de gravar formulários que criam ou editam valor (PD-37).

## Documentos fonte

* `docs/decisions/business-decisions.md` (PD-37)
* `docs/specs/home.md` §7
* `docs/specs/installments.md` §6

## Escopo

* Diálogo de resumo no estilo de `ConfirmDialog`.
* Aplicar a: lançamento novo e edição, recorrência nova e edição, estorno e edição de compra parcelada (T-56).
* Parcelado: mostrar valor por parcela, com a distribuição de centavos da spec (não pode divergir da do backend).

## Fora de escopo

* Qualquer regra não descrita nos documentos fonte.

## Critérios de aceite

* Confirmar grava; Voltar retorna ao formulário sem perder dados; erro da API é exibido.

## Testes obrigatórios

* Testes de componente do resumo e do fluxo em cada formulário.

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

* `SummaryDialog` + `confirmSummary()` em `shared/ui/summary-dialog.ts` (estilo do `ConfirmDialog`: Voltar/Confirmar). Aplicado a lançamento novo e edição, recorrência nova e edição, estorno e edição de compra parcelada (T-56).
* Lançamento no cartão: o resumo mostra a fatura (`Fatura`/`Primeira fatura`) vinda de `GET /credit-cards/:id/posting-preview` (T-52); se a prévia falhar, a linha é omitida. Parcelado mostra `describeInstallments` (`shared/format/installments.ts`), só para exibição; o backend continua dono do cálculo.
* Testes usam o diálogo real (overlay) com os helpers `summaryRow` e `answerSummary`.
