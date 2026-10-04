# T-40 — Formulário de lançamento

* **Fase:** 4 — Frontend
* **Depende de:** T-21, T-22, T-26, T-39
* **Status:** Concluída

## Objetivo

Implementar o modal "+ Lançamento".

## Documentos fonte

* `docs/specs/home.md` — §7
* `docs/specs/transactions.md`
* `docs/specs/credit-cards.md` — §9
* `docs/specs/installments.md` — §4

## Escopo

* Entrada/saída; descrição; valor; data; categoria (filtrada pelo tipo e ativas); método (ativos).
* Ao escolher cartão: data da compra e quantidade de parcelas (1 = à vista; ≥ 2 = parcelado).
* Envio para o endpoint correto e exibição de erros.

## Fora de escopo

* Recorrências (T-44).

## Critérios de aceite

* Criação de lançamento manual, compra à vista e parcelada a partir da Home.

## Testes obrigatórios

* Testes de componente dos três fluxos.

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

* Diálogo "Novo lançamento" (`transaction-form-dialog.ts`): categorias ativas filtradas pelo tipo, métodos ativos. Método comum envia `due_date`; cartão envia `purchase_date` e, com parcelas ≥ 2, `installment_count` (1 = à vista, omitido). O tipo não é enviado (deriva da categoria).
