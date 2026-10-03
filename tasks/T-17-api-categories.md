# T-17 — API de categorias

* **Fase:** 3 — API
* **Depende de:** T-15
* **Status:** A fazer

## Objetivo

Implementar o módulo de categorias.

## Documentos fonte

* `docs/specs/categories.md`
* `docs/architecture/architecture.md` — §18.1

## Escopo

* Listar, criar, editar (nome; tipo somente sem uso), ativar e desativar.
* Validação de nome (trim, 1–100, único sem diferenciar maiúsculas/minúsculas entre ativas e inativas).
* Verificação de uso: lançamentos e recorrências.
* Sem `DELETE`.

## Fora de escopo

* Efeito em recorrências (tratado pela T-29/T-30).

## Critérios de aceite

* CA-CAT-01 a CA-CAT-11.

## Testes obrigatórios

* Testes de API para cada critério.
* Tipo bloqueado com uso em lançamento e em recorrência.

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
