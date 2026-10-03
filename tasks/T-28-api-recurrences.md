# T-28 — Cadastro de recorrências

* **Fase:** 3 — API
* **Depende de:** T-17, T-18, T-23
* **Status:** Concluída

## Objetivo

Implementar o cadastro e o ciclo de vida das recorrências.

## Documentos fonte

* `docs/specs/recurrences.md` — §3, §7, §8, §11, §12
* `docs/architecture/architecture.md` — §18.8

## Escopo

* Criar, listar, detalhar e editar (descrição, valor, dia, categoria, método, `end_date`; categoria e método ativos).
* Pausar (`paused_from` hoje ou futuro, `paused_until` opcional), retomar, cancelar.
* Status `PAUSED` enquanto a pausa estiver vigente, usando o mecanismo da T-23.
* Alterações não tocam ocorrências geradas.

## Fora de escopo

* Projeção (T-29), geração (T-30) e ações em ocorrências (T-31).

## Critérios de aceite

* CA-REC-01, CA-REC-06, CA-REC-12 (cadastro), CA-REC-17.

## Testes obrigatórios

* Testes de API: validações, pausa vigente e agendada, retomada, cancelamento definitivo.

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

* Nova coluna técnica `recurrences.created_on` (migration `technical_additions`): data de criação segundo o relógio injetado, usada na condição 1 da elegibilidade (não há ocorrência anterior à criação). Mais a tabela técnica `job_states`.
* Pausa: só recorrência `ACTIVE` pausa; `paused_from` hoje ou futuro; `paused_until` posterior. Retomar encerra a pausa vigente em hoje (`paused_until = hoje`) ou cancela uma pausa agendada. Cancelar grava `cancelled_at` (CD-22). Estados inválidos → `RECURRENCE_INVALID_STATE`/`RECURRENCE_CANCELLED`; pausa inválida → `INVALID_PAUSE_PERIOD`.
* Alterações em recorrência cancelada são rejeitadas (`RECURRENCE_CANCELLED`).
