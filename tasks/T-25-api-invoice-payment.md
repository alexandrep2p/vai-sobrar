# T-25 — Pagar fatura

* **Fase:** 3 — API
* **Depende de:** T-24
* **Status:** A fazer

## Objetivo

Implementar a ação "Pagar fatura" com liquidação atômica e transferência de saldo credor.

## Documentos fonte

* `docs/specs/invoices.md` — §8, §9
* `docs/architecture/architecture.md` — §11.3, §11.4

## Escopo

* Pré-condições: `CLOSED`, mês aberto, `paid_at` válido (≤ hoje, fora de mês fechado), método ativo diferente do próprio cartão.
* Efeitos atômicos: lançamentos → `PAID`; fatura → `PAID` com `paid_at` e `payment_method_id`; `credit_balance` apurado e transferido para a próxima fatura não paga (`OPEN` ou `CLOSED`), ou pendente até existir.
* Vincular transferências pendentes quando uma fatura de ciclo posterior for criada.
* Pagamento de R$ 0,00 permitido.

## Fora de escopo

* Desfazer pagamento (não existe).

## Critérios de aceite

* CA-FAT-04 a CA-FAT-12, CA-FAT-14, CA-FAT-21.

## Testes obrigatórios

* Testes de API dos critérios.
* Atomicidade em falha.
* Transferência pendente vinculada depois.

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
