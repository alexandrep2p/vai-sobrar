# T-07 — Domínio: distribuição de centavos

* **Fase:** 1 — Domínio puro
* **Depende de:** T-04
* **Status:** A fazer

## Objetivo

Implementar `splitCents(total, n)` e a variante proporcional usada por estornos.

## Documentos fonte

* `docs/specs/installments.md` — §6
* `docs/specs/refunds.md` — §7.3

## Escopo

* `splitCents`: piso para todos, centavos restantes nas últimas posições.
* Função de rateio proporcional por pesos (piso por cota, resto nas últimas posições participantes), reutilizável por `allocateRefund`.

## Fora de escopo

* Regras de estorno (T-10).

## Critérios de aceite

* CA-PAR-01, CA-PAR-02, CA-PAR-03.
* Soma sempre igual ao total.

## Testes obrigatórios

* Divisão exata e com resto.
* n = 2 e n grande (120).
* Rateio proporcional com pesos desiguais (33,33/33,33/34,34).

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
