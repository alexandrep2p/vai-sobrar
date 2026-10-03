# T-43 — Fluxo de estorno

* **Fase:** 4 — Frontend
* **Depende de:** T-27, T-42
* **Status:** A fazer

## Objetivo

Permitir estornar compras de cartão.

## Documentos fonte

* `docs/specs/refunds.md`

## Escopo

* Ação disponível apenas para compras de cartão (à vista, parcelada, ocorrência de cartão gerada).
* Formulário: valor (exibindo saldo estornável), data do estorno e, para parcelado, estratégia.
* Exibir situação estornada/parcialmente estornada na compra.

## Fora de escopo

* Estorno de outros métodos (não existe).

## Critérios de aceite

* Estorno total e parcial a partir da compra; erros de limite exibidos.

## Testes obrigatórios

* Testes de componente do formulário.

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
