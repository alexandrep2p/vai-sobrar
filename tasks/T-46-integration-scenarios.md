# T-46 — Cenários de integração ponta a ponta

* **Fase:** 5 — Validação
* **Depende de:** T-34
* **Status:** A fazer

## Objetivo

Validar os fluxos que atravessam várias specs com testes de integração no backend.

## Documentos fonte

* Critérios de aceitação de todas as specs
* `docs/specs/docs/decisions/business-decisions.md`

## Escopo

* Cenários: compra tardia; vencimento no mês seguinte e fechamento do mês; estorno tardio de compra em mês fechado; saldo credor transportado para fatura `CLOSED`; recorrência com cartão desativado e reativado; parcelamento com estorno `FIRST_INSTALLMENTS` com primeira parcela paga; fechamento cronológico com mês anterior sem lançamentos; fatura só com créditos bloqueando o fechamento.

## Fora de escopo

* Testes de interface ponta a ponta (opcional, fora desta task).

## Critérios de aceite

* Todos os cenários passam com relógio fixo e banco de teste limpo.

## Testes obrigatórios

* Um teste de integração por cenário.

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
