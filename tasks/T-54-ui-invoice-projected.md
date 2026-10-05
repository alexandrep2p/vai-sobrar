# T-54 — Fatura com itens previstos

* **Fase:** 4 — Frontend
* **Depende de:** T-53
* **Status:** Concluída

## Objetivo

Mostrar ocorrências previstas e total somado nas telas de faturas.

## Documentos fonte

* `docs/specs/invoices.md` §4 e §7

## Escopo

* Selo "Previsto" no detalhe, total com a parte prevista discriminada e "Detalhes" habilitado em ciclos com previsão.
* Aviso no "Pagar fatura" de que as ocorrências previstas serão geradas e pagas.

## Fora de escopo

* Qualquer regra não descrita nos documentos fonte.

## Critérios de aceite

* Exemplo: R$ 500,00 + R$ 40,00 previsto = R$ 540,00.

## Testes obrigatórios

* Testes de componente da lista, do detalhe e do pagamento.

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

* Lista: ciclo com previsão mostra o total somado, "inclui R$ X previsto" e o selo "Previsto" (sem fatura persistida); "Detalhes" abre `GET /credit-cards/:id/invoices/:month` quando não há `id`. Detalhe: seção "Recorrências previstas", parte prevista nos totais e aviso no "Pagar fatura". Sem fatura persistida não há botão de pagar.
