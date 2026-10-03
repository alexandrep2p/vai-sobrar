# T-20 — Serviço de meses e guarda de mês fechado

* **Fase:** 3 — API
* **Depende de:** T-08, T-15
* **Status:** A fazer

## Objetivo

Criar o serviço que informa o estado de qualquer mês (lógico ou persistido) e a guarda usada por todas as escritas.

## Documentos fonte

* `docs/specs/financial-periods.md` — §2, §5
* `docs/architecture/architecture.md` — §7.2, §16

## Escopo

* Estado do mês: `OPEN` sem registro; registro quando necessário.
* Guarda reutilizável que rejeita (`PERIOD_CLOSED`) qualquer escrita em mês fechado (origem e destino).
* `GET /api/financial-periods/:month`.

## Fora de escopo

* Fechamento (T-33).

## Critérios de aceite

* Mês sem registro é exibido como `OPEN`.
* Escrita em mês fechado é rejeitada pela guarda.

## Testes obrigatórios

* Mês lógico; mês persistido aberto e fechado; guarda em origem e destino.

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
