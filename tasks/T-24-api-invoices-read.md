# T-24 — Leitura de faturas

* **Fase:** 3 — API
* **Depende de:** T-09, T-23
* **Status:** A fazer

## Objetivo

Expor faturas persistidas e ciclos projetados vazios, com totais e situação.

## Documentos fonte

* `docs/specs/invoices.md` — §3, §4, §6, §7, §11
* `docs/architecture/architecture.md` — §18.4

## Escopo

* `GET /api/credit-cards/:id/invoices?from&to`: persistidas + ciclos sem fatura ("Sem lançamentos", R$ 0,00), calculados com a configuração vigente.
* `GET /api/invoices/:id`: lançamentos postados, créditos reconhecidos, crédito recebido, valor a pagar, saldo credor.
* Situação derivada `OVERDUE` (independe do valor).
* Cartão desativado sem lançamentos futuros deixa de aparecer na visão futura.

## Fora de escopo

* Pagamento (T-25).

## Critérios de aceite

* CA-FAT-13, CA-FAT-15, CA-FAT-16, CA-FAT-17, CA-FAT-20.

## Testes obrigatórios

* Testes de API dos critérios.
* Ciclo projetado não é persistido.

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
