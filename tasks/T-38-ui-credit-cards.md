# T-38 — Tela de cartões

* **Fase:** 4 — Frontend
* **Depende de:** T-19, T-35
* **Status:** Concluída

## Objetivo

Implementar a tela de cartões.

## Documentos fonte

* `docs/specs/credit-cards.md` — §3, §12, §13

## Escopo

* Listar, criar, editar (nome, melhor dia, vencimento), ativar/desativar.
* Aviso de que mudanças valem só para ciclos futuros.

## Fora de escopo

* Faturas (T-42).

## Critérios de aceite

* Cadastro e edição funcionais com validação de dias 1–31.

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

## Decisões técnicas registradas

* Tela em `features/credit-cards`: lista, criar, editar (nome, melhor dia, vencimento, dias 1–31), (des)ativar e atalho para as faturas do cartão (`/faturas?cartao=id`). A edição exibe o aviso de que a mudança vale só para ciclos futuros.
