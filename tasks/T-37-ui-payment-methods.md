# T-37 — Tela de métodos de pagamento

* **Fase:** 4 — Frontend
* **Depende de:** T-18, T-35
* **Status:** A fazer

## Objetivo

Implementar a tela de métodos de pagamento.

## Documentos fonte

* `docs/specs/payment-methods.md` — §10

## Escopo

* Lista ativos/inativos com origem e tipo; criar método comum; editar personalizado; ativar/desativar; cartões direcionam para a tela de cartões.

## Fora de escopo

* Cadastro de cartão (T-38).

## Critérios de aceite

* Tabela de ações da payment-methods §10 respeitada.

## Testes obrigatórios

* Testes de componente das ações principais.

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
