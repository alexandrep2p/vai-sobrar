# T-30 — Geração de ocorrências na data

* **Fase:** 3 — API
* **Depende de:** T-29, T-22
* **Status:** Concluída

## Objetivo

Gerar (persistir) as ocorrências quando a data chega, de forma garantida e idempotente.

## Documentos fonte

* `docs/specs/recurrences.md` — §5, §6, §13, §14
* `docs/architecture/architecture.md` — §12, §26

## Escopo

* Gerar ocorrências com data ≤ hoje usando a configuração vigente.
* Avaliar elegibilidade com o estado **na data da ocorrência** (método e categoria ativos).
* Ocorrência de cartão postada como compra (`postingInvoice`, inclusive compra tardia).
* Idempotência por `(recurrence_id, occurrence_month)`.
* Garantir a geração independentemente de acesso do usuário.

## Fora de escopo

* Ações do usuário em ocorrências (T-31).

## Critérios de aceite

* CA-REC-02, CA-REC-13, CA-REC-14 (geração).
* CA-CAT-13 e CA-MET-13 (categoria ou método desativado não gera ocorrências).

## Testes obrigatórios

* Geração na data com relógio fixo.
* Duas execuções não duplicam.
* Método inativo na data não gera; reativação não gera retroativo.

## Decisões técnicas registradas

* **Técnica escolhida (architecture §26):** geração por avaliação periódica com **marca d'água** (`job_states.occurrence_generation_watermark`). Cada execução processa as datas em `(marca, hoje]` avaliando o estado de método/categoria **vigente na execução**; a execução roda a cada acesso à API e a cada 15 min no servidor, e a marca d'água impede qualquer geração retroativa (reativação, fim de pausa).
* Eventos que mudam a elegibilidade no próprio dia (criar recorrência, retomar, reativar método/categoria/cartão) chamam a geração com `fromToday`, para que a ocorrência da data de hoje não se perca. Idempotência por lock da recorrência + unicidade `(recurrence_id, occurrence_month)`.
* Falha ao gerar uma ocorrência é registrada em log e não derruba as requisições.
