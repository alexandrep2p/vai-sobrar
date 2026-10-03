# T-32 — Extrato mensal

* **Fase:** 3 — API
* **Depende de:** T-21, T-24, T-27, T-29
* **Status:** Concluída

## Objetivo

Implementar `GET /api/monthly-statement?month=YYYY-MM`.

## Documentos fonte

* `docs/specs/home.md` — §2, §3
* `docs/architecture/architecture.md` — §10
* `docs/specs/financial-periods.md` — §3

## Escopo

* Estado do mês; lançamentos com `financial_month`; ocorrências projetadas; alocações de estorno reconhecidas em faturas do mês.
* Totais: entradas e saídas com estornos abatidos pela natureza da compra original; saldo previsto.
* Itens com os campos da architecture §10; data exibida por tipo; ordenação pela data exibida.
* Parcela com `n/N` e referência ao plano.

## Fora de escopo

* Tela (T-39).

## Critérios de aceite

* CA-HOME-02 a CA-HOME-09, CA-HOME-12.
* Exemplo de home §4 reproduzido em teste.

## Testes obrigatórios

* Teste de integração reproduzindo o extrato de janeiro/2027 de home §4.
* Status não altera totais.
* Saldo credor transportado não entra nos totais.

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

* Itens com `item_type` (`TRANSACTION`, `PROJECTED_OCCURRENCE`, `REFUND_CREDIT`), `display_date` por tipo, `amount` (positivo) e `signed_amount` (entradas e créditos de saída positivos). Ordenação pela data de exibição; empates: lançamentos, projeções, créditos.
* Totais: `incomes`, `expenses` (com créditos abatidos pela natureza da compra original) e `balance`. Teste reproduz o extrato de janeiro/2027 da home §4 (8.800 / 2.759 / 6.041).
