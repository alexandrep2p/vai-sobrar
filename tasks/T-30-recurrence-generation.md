# T-30 — Geração de ocorrências na data

* **Fase:** 3 — API
* **Depende de:** T-29, T-22
* **Status:** A fazer

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

_Registrar aqui a técnica escolhida para garantir a geração na data e para avaliar "ativo na data" (architecture §26)._

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
