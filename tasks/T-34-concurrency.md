# T-34 — Proteção contra concorrência

* **Fase:** 3 — API
* **Depende de:** T-25, T-27, T-30, T-33
* **Status:** A fazer

## Objetivo

Proteger as operações críticas contra execução simultânea.

## Documentos fonte

* `docs/architecture/architecture.md` — §20

## Escopo

* Escolher o mecanismo por caso (lock de linha, nível de isolamento, constraint) e aplicar a: pagamento duplo da fatura; pagamento concorrente com postagem ou crédito; fechamento duplo ou concorrente com alteração; estornos simultâneos da mesma compra; geração duplicada de ocorrência; criação duplicada de fatura.

## Fora de escopo

* Novas regras de negócio.

## Critérios de aceite

* Cada cenário da architecture §20 produz resultado consistente.

## Testes obrigatórios

* Testes de integração com operações paralelas para cada cenário.

## Decisões técnicas registradas

_Registrar aqui o mecanismo usado em cada cenário._

* (preencher durante a implementação)

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
