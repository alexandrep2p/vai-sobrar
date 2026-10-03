# T-12 — Domínio: elegibilidade e data de ocorrência

* **Fase:** 1 — Domínio puro
* **Depende de:** T-05
* **Status:** A fazer

## Objetivo

Implementar a data da ocorrência e `occurrenceEligibility`.

## Documentos fonte

* `docs/specs/recurrences.md` — §4, §5, §11, §12, §14

## Escopo

* Data da ocorrência do mês M com ajuste de dias.
* Sete condições de elegibilidade (início/criação, término, cancelamento, pausa, exceção, método/categoria ativos na data, mês fechado para método comum).
* Para cartão, retorna a data como `purchase_date` (a fatura é resolvida pela T-06).

## Fora de escopo

* Projeção e geração (T-29, T-30).

## Critérios de aceite

* CA-REC-02, CA-REC-03, CA-REC-11, CA-REC-13 (elegibilidade).

## Testes obrigatórios

* Criada no meio do mês.
* Dia 31.
* Pausa com e sem retorno.
* Cancelada.
* Com exceção.
* Método/categoria inativos e reativação.
* `end_date`.

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
