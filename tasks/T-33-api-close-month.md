# T-33 — Fechamento do mês

* **Fase:** 3 — API
* **Depende de:** T-13, T-25, T-31
* **Status:** Concluída

## Objetivo

Implementar `POST /api/financial-periods/:month/close`.

## Documentos fonte

* `docs/specs/financial-periods.md` — §4, §5
* `docs/architecture/architecture.md` — §15

## Escopo

* Aplicar `canClose` com dados reais e persistir `CLOSED` + `closed_at` em transação.
* Sem reabertura.
* Validar que todas as escritas existentes respeitam a barreira (revisão das guardas da T-20 nos módulos).

## Fora de escopo

* Tela (T-45).

## Critérios de aceite

* CA-PER-01 a CA-PER-10.

## Testes obrigatórios

* Testes de API dos critérios.
* Barreira de imutabilidade em lançamentos, faturas, estornos e recorrências após o fechamento.

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

* `canClose` é alimentado por contagens reais dentro de uma transação com o lock exclusivo de meses. `closed_at` usa o instante real do servidor. A resposta de recusa traz `details` com as contagens (lançamentos pendentes, ocorrências projetadas, faturas não pagas).
