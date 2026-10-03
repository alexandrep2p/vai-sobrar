# T-19 — API de cartões

* **Fase:** 3 — API
* **Depende de:** T-18
* **Status:** A fazer

## Objetivo

Implementar o módulo de cartões de crédito.

## Documentos fonte

* `docs/specs/credit-cards.md` — §2, §3, §12, §13
* `docs/architecture/architecture.md` — §18.3

## Escopo

* Criar (PaymentMethod `CREDIT_CARD` + CreditCard em uma transação), listar, detalhar, editar (nome, melhor dia, vencimento), ativar e desativar (em `PaymentMethod.active`).
* Validação de dias 1–31.
* Alteração de configuração não toca faturas persistidas.

## Fora de escopo

* Faturas e compras.

## Critérios de aceite

* CA-CAR-01, CA-CAR-10 (parte de configuração), CA-CAR-14 (parte de cadastro).

## Testes obrigatórios

* Criação atômica (falha no segundo insert não deixa método órfão).
* Nome único entre métodos.
* Desativar e reativar.

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
