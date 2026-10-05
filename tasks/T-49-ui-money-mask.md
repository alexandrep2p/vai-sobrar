# T-49 — Máscara de valor monetário

* **Fase:** 4 — Frontend
* **Depende de:** T-40
* **Status:** Concluída

## Objetivo

Criar o campo de valor com máscara em tempo real, reutilizável (PD-37).

## Documentos fonte

* `docs/decisions/business-decisions.md` (PD-37)

## Escopo

* Diretiva ou `ControlValueAccessor` em `shared/forms/` reutilizando `parseCents` e `centsToInput`.
* Digitação da direita para a esquerda: 1 → 0,01 → 0,12 → 1,23; milhar com ponto.
* Trocar o input de valor em lançamento novo, edição de lançamento, recorrência e estorno.

## Fora de escopo

* Qualquer regra não descrita nos documentos fonte.

## Critérios de aceite

* Valor do controle continua compatível com `positiveMoney`/`nonNegativeMoney` e vira centavos inteiros.

## Testes obrigatórios

* Testes da diretiva (digitação, colar, apagar, valor inicial) e dos formulários.

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

* Diretiva `appMoneyInput` (`shared/forms/money-input.ts`, `ControlValueAccessor`): exibe `1.234,56` e grava no controle `1234,56` (formato de `centsToInput`), compatível com `parseCents` e os validators. Limite de 12 dígitos; só zeros viram vazio. Formatador `formatMoneyInput` em `shared/format/money.ts`.
