# T-45 — Fluxo de fechamento do mês

* **Fase:** 4 — Frontend
* **Depende de:** T-33, T-39
* **Status:** A fazer

## Objetivo

Implementar a ação "Fechar mês".

## Documentos fonte

* `docs/specs/home.md` — §7
* `docs/specs/financial-periods.md` — §4

## Escopo

* Botão disponível com mês aberto; confirmação com aviso de irreversibilidade; exibição do motivo quando rejeitado; atualização do estado visual.

## Fora de escopo

* Reabertura (não existe).

## Critérios de aceite

* CA-HOME-10 e exibição de mês fechado sem ações de alteração.

## Testes obrigatórios

* Testes de componente da confirmação e da rejeição.

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
