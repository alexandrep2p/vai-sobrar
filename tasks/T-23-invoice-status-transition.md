# T-23 — Transição automática de fatura e de pausa

* **Fase:** 3 — API
* **Depende de:** T-22
* **Status:** A fazer

## Objetivo

Garantir que o status persistido de faturas (`OPEN → CLOSED`) e de recorrências com pausa programada esteja sempre correto.

## Documentos fonte

* `docs/specs/invoices.md` — §5
* `docs/specs/recurrences.md` — §11
* `docs/architecture/architecture.md` — §11.2, §26

## Escopo

* Escolher e implementar o mecanismo (rotina agendada, avaliação ao acessar ou ambos), determinístico e idempotente.
* Aplicar a faturas cujo `closing_date` já passou.
* Deixar o mecanismo preparado para ser reutilizado pela pausa de recorrência (T-28) e pela geração na data (T-30).

## Fora de escopo

* Geração de ocorrências (T-30).

## Critérios de aceite

* CA-FAT-03.
* Leituras e escritas sempre veem o status correto.

## Testes obrigatórios

* Fatura passa a `CLOSED` no dia seguinte ao fechamento (relógio fixo).
* Idempotência ao rodar duas vezes.

## Decisões técnicas registradas

_Registrar aqui o mecanismo escolhido (decisão técnica aberta da architecture §26)._

* (preencher durante a implementação)

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
