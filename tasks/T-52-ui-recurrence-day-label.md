# T-52 — Rótulo e dica do dia da recorrência

* **Fase:** 4 — Frontend
* **Depende de:** T-44
* **Status:** Concluída

## Objetivo

Rótulo do dia conforme o contexto e dica da fatura prevista no cartão (PD-34).

## Documentos fonte

* `docs/decisions/business-decisions.md` (PD-34)
* `docs/specs/recurrences.md` §3 e §13
* `docs/specs/credit-cards.md` §8

## Escopo

* Conta/saída: "Dia do vencimento". Conta/entrada: "Dia do recebimento". Cartão: "Dia da cobrança" + dica "Cairá na fatura de <mês> (vence <data>)".
* A dica usa a regra de fatura de postagem; não reimplementar no frontend: usar um endpoint de preview do backend ou reaproveitar o que a projeção já devolve. Registrar a escolha em "Decisões técnicas registradas".

## Fora de escopo

* Qualquer regra não descrita nos documentos fonte.

## Critérios de aceite

* Rótulo muda com método e tipo da categoria; dica correta nos exemplos de `recurrences.md` §13.

## Testes obrigatórios

* Testes de componente (3 rótulos e dica) e, se houver endpoint, teste de API.

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

* Escolha da dica: **endpoint de prévia no backend** `GET /api/credit-cards/:id/posting-preview?purchase_date=` (somente leitura, usa `postingInvoice` do domínio, inclusive compra tardia). O frontend só calcula a próxima data de cobrança (`nextOccurrenceDate`, ajuste de mês curto) para consultar a prévia; a regra de elegibilidade continua no backend.
* Rótulo: cartão → "Dia da cobrança"; categoria de entrada → "Dia do recebimento"; demais → "Dia do vencimento". Teste de API em `cards.int.spec.ts`.
