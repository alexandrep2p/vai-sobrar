# T-34 — Proteção contra concorrência

* **Fase:** 3 — API
* **Depende de:** T-25, T-27, T-30, T-33
* **Status:** Concluída

## Objetivo

Proteger as operações críticas contra execução simultânea.

## Documentos fonte

* `docs/architecture/architecture.md` — §20

## Escopo

* Escolher o mecanismo por caso (lock de linha, nível de isolamento, constraint) e aplicar a: pagamento duplo da fatura; pagamento concorrente com postagem ou crédito; fechamento duplo ou concorrente com alteração; estornos simultâneos da mesma compra; geração duplicada de ocorrência; criação duplicada de fatura.

## Fora de escopo

* Novas regras de negócio.

## Critérios de aceite

* Cada cenário da architecture §20 produz resultado consistente.

## Testes obrigatórios

* Testes de integração com operações paralelas para cada cenário.

## Decisões técnicas registradas

* Mecanismo geral: locks advisory de transação do PostgreSQL (`pg_advisory_xact_lock`), em ordem fixa (períodos → cartão/recorrência) para evitar deadlock.
* Pagamento duplo / pagamento × postagem / estorno duplo / parcelamento: lock do cartão (reavalia o estado sob o lock). Criação duplicada de fatura: `INSERT ... ON CONFLICT DO NOTHING` + unicidade `(cartão, mês)`. Fechamento duplo e fechamento × escritas: lock exclusivo de meses no fechamento, compartilhado nas escritas. Geração duplicada de ocorrência: lock da recorrência + unicidade `(recurrence_id, occurrence_month)`; pular × gerar: mesmo lock.
* Cobertura: `tests/api/concurrency.int.spec.ts` (operações paralelas por cenário).
