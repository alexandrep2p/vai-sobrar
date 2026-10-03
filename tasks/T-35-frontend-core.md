# T-35 — Base do frontend

* **Fase:** 4 — Frontend
* **Depende de:** T-03
* **Status:** A fazer

## Objetivo

Criar a base compartilhada das telas.

## Documentos fonte

* `docs/architecture/architecture.md` — §5
* `docs/domain/domain-model.md` — §5

## Escopo

* Layout principal e navegação (Home, Faturas, Recorrências, Categorias, Métodos, Cartões).
* Cliente HTTP com tratamento padronizado dos erros de negócio (código → mensagem em português).
* Formatação de dinheiro (centavos → R$) e datas.
* Tradução dos enums para as labels da domain-model §5.

## Fora de escopo

* Telas de negócio.

## Critérios de aceite

* Navegação funcional entre as rotas.
* Erro de negócio da API é exibido com mensagem amigável.

## Testes obrigatórios

* Testes unitários das formatações e do mapeamento de labels e de erros.

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
