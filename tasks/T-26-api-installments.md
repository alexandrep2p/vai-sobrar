# T-26 — Compra parcelada

* **Fase:** 3 — API
* **Depende de:** T-07, T-22
* **Status:** A fazer

## Objetivo

Implementar criação, leitura e edição de compras parceladas.

## Documentos fonte

* `docs/specs/installments.md`
* `docs/architecture/architecture.md` — §13, §18.6

## Escopo

* Criação atômica: plano, `splitCents`, parcela 1 pela regra de postagem, parcelas seguintes nos ciclos seguintes, faturas necessárias, transações e installments.
* Mínimo 2, limite técnico 120.
* `GET /api/installment-plans/:id` com as parcelas.
* `PUT /api/installment-plans/:id`: descrição e categoria em todas as parcelas, somente se todas estiverem em meses abertos e em faturas não pagas.
* Rejeitar edição isolada de valor/estrutura, exclusão e pagamento individual de parcela.

## Fora de escopo

* Estorno (T-27).

## Critérios de aceite

* CA-PAR-01 a CA-PAR-12.

## Testes obrigatórios

* Testes de API dos critérios.
* Rollback se uma parcela falhar.

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
