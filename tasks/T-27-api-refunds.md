# T-27 — Estornos

* **Fase:** 3 — API
* **Depende de:** T-10, T-11, T-25, T-26
* **Status:** A fazer

## Objetivo

Implementar o registro de estornos de compras de cartão.

## Documentos fonte

* `docs/specs/refunds.md`
* `docs/architecture/architecture.md` — §14, §18.7

## Escopo

* `POST /api/refunds` com alvo (compra à vista, ocorrência de cartão gerada ou plano), valor, `refund_date` e estratégia (somente plano).
* Rejeitar alvos não permitidos (`REFUND_TARGET_NOT_ALLOWED`), valor acima do saldo, data inválida.
* Persistir `Refund` + `RefundAllocation` + faturas criadas, em transação.
* Consultas: por id, por lançamento e por plano, com saldo estornável e situação derivada (estornada / parcialmente estornada).

## Fora de escopo

* Exibição na Home (T-32).

## Critérios de aceite

* CA-EST-01 a CA-EST-15, CA-FAT-18, CA-REC-15 (parte de estorno).

## Testes obrigatórios

* Testes de API dos critérios.

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
