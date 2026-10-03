# T-39 — Home: navegação, resumo e extrato

* **Fase:** 4 — Frontend
* **Depende de:** T-32, T-35
* **Status:** A fazer

## Objetivo

Implementar a tela principal.

## Documentos fonte

* `docs/specs/home.md`

## Escopo

* Seletor de mês; estado do mês; resumo (entradas, saídas, saldo); extrato com itens, sinais, status, data exibida, `n/N`, link para a compra original, linhas de crédito de estorno e ocorrências projetadas; saldo ao final.

## Fora de escopo

* Formulário de lançamento (T-40) e ações (T-41, T-45).

## Critérios de aceite

* CA-HOME-01, CA-HOME-06, CA-HOME-11 (visual), CA-HOME-12 (visual).
* Exemplo de home §4 exibido corretamente com dados equivalentes.

## Testes obrigatórios

* Testes de componente: navegação, resumo e renderização dos tipos de item.

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
