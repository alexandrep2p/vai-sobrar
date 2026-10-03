# T-44 — Telas de recorrências e ações em ocorrências

* **Fase:** 4 — Frontend
* **Depende de:** T-28, T-31, T-39
* **Status:** A fazer

## Objetivo

Implementar o cadastro de recorrências e as ações nas ocorrências.

## Documentos fonte

* `docs/specs/recurrences.md`

## Escopo

* Lista, criação e edição da recorrência; pausar (com início e retorno), retomar, cancelar.
* Na Home: editar, pagar e pular ocorrência, conforme as permissões (categoria nunca editável na ocorrência).

## Fora de escopo

* Estorno (T-43).

## Critérios de aceite

* Fluxos de cadastro, pausa, cancelamento e pular ocorrência funcionando.

## Testes obrigatórios

* Testes de componente dos fluxos principais.

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
