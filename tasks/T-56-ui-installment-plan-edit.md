# T-56 — Edição de compra parcelada (frontend)

* **Fase:** 4 — Frontend
* **Depende de:** T-55, T-49, T-50
* **Status:** Concluída

## Objetivo

Editar a compra parcelada a partir de "Ver compra original" (PD-36).

## Documentos fonte

* `docs/decisions/business-decisions.md` (PD-36)
* `docs/specs/installments.md` §8
* `docs/specs/home.md` RN-HOME-05A

## Escopo

* Botão "Editar" no diálogo de compra original com valor, parcelas e data (máscara e resumo).
* Desabilitar com a explicação do bloqueio quando houver parcela paga, mês fechado ou estorno.

## Fora de escopo

* Qualquer regra não descrita nos documentos fonte.

## Critérios de aceite

* Editar atualiza as parcelas exibidas e a Home.

## Testes obrigatórios

* Testes de componente (edição, bloqueios, erro da API).

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

* `PlanEditDialog` (valor com máscara, parcelas e data) aberto por "Editar compra" em "Ver compra original". O botão fica desabilitado, com explicação, se houver parcela em fatura paga; mês fechado e estorno são validados pelo backend e o erro é exibido pelo interceptor. Ao salvar, o detalhe fecha com `true` e a Home recarrega.
