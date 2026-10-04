# T-18 — API de métodos de pagamento

* **Fase:** 3 — API
* **Depende de:** T-16
* **Status:** Concluída

## Objetivo

Implementar o módulo de métodos de pagamento.

## Documentos fonte

* `docs/specs/payment-methods.md`
* `docs/architecture/architecture.md` — §18.2

## Escopo

* Listar, criar (somente `STANDARD`), editar nome (somente `USER` + `STANDARD`), ativar e desativar.
* Nome único entre todos os métodos, inclusive cartões.
* Bloquear criação de método com comportamento de crédito pelo fluxo genérico.
* Sem `DELETE`.

## Fora de escopo

* Cartões (T-19).

## Critérios de aceite

* CA-MET-01 a CA-MET-11.

## Testes obrigatórios

* Testes de API para cada critério, inclusive edição de método do sistema rejeitada e nome igual ao de um cartão.

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

* `POST` aceita só `name` (e `kind: "STANDARD"` opcional); qualquer outro campo, inclusive `source` e `kind: "CREDIT_CARD"`, é rejeitado por validação (400). `PUT` de método `SYSTEM` ou cartão → `PAYMENT_METHOD_NOT_EDITABLE`. Códigos novos: `PAYMENT_METHOD_NOT_FOUND`, `PAYMENT_METHOD_NAME_TAKEN`.
