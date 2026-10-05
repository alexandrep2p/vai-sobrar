# T-48 — Formulários: botão desabilitado enquanto inválido

* **Fase:** 4 — Frontend
* **Depende de:** T-40, T-44
* **Status:** Concluída

## Objetivo

Manter o botão de confirmação desabilitado enquanto o formulário for inválido (PD-37).

## Documentos fonte

* `docs/decisions/business-decisions.md` (PD-37)
* `docs/specs/home.md` §7

## Escopo

* Acrescentar `form.invalid` ao `[disabled]` do botão submit de: lançamento novo, edição de lançamento, estorno, recorrência, pausa, categoria, cartão, método de pagamento e `pay-dialog`.
* Manter `markAllAsTouched()` no `save()`.
* `pay-dialog` passa a respeitar também `submitting`.

## Fora de escopo

* Qualquer regra não descrita nos documentos fonte.

## Critérios de aceite

* Dialog inválido: botão desabilitado. Dialog válido: habilitado. Durante o envio: desabilitado.

## Testes obrigatórios

* Um teste por dialog (inválido/válido/enviando); ajustar `dialogs.spec.ts`.

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

* Botão desabilitado por `form.invalid` (além de `submitting()`/`loading()`) nos 9 dialogs; o erro de campo continua aparecendo só após o campo ser tocado. Helper de teste `submitButton` em `testing/helpers.ts`.
