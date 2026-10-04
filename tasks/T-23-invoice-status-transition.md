# T-23 — Transição automática de fatura e de pausa

* **Fase:** 3 — API
* **Depende de:** T-22
* **Status:** Concluída

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

* **Mecanismo escolhido (architecture §26):** avaliação a cada acesso à API (middleware `refreshState`, antes de qualquer rota `/api`) **somada** a uma rotina periódica no servidor (`startBackgroundJobs`, a cada 15 min e na inicialização). A transição é um único `UPDATE` idempotente (`OPEN` com `closing_date < hoje` → `CLOSED`); a pausa de recorrência segue o mesmo mecanismo (`syncRecurrencePauses`).
