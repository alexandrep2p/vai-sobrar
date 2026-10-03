# T-29 — Projeção de ocorrências

* **Fase:** 3 — API
* **Depende de:** T-12, T-28
* **Status:** Concluída

## Objetivo

Calcular ocorrências futuras não geradas a partir da configuração atual, sem persistir.

## Documentos fonte

* `docs/specs/recurrences.md` — §5, §6, §13, §14
* `docs/specs/financial-periods.md` — §3

## Escopo

* Serviço que, para um mês, retorna as ocorrências projetadas elegíveis (data futura, sem geração, sem exceção).
* Recorrência com cartão: fatura e mês financeiro projetados pela regra do ciclo.
* Método/categoria inativos hoje → não projeta.

## Fora de escopo

* Geração (T-30).

## Critérios de aceite

* CA-REC-04, CA-REC-05, CA-REC-09 (projeção), CA-REC-14.
* CA-CAT-13 e CA-MET-13 (categoria ou método desativado não projeta ocorrências).

## Testes obrigatórios

* Mês distante sem meses intermediários persistidos.
* Alteração reflete imediatamente nas projeções.
* Cartão: fatura projetada correta.

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

* Projeção calculada na leitura, sem persistir. Para o mês financeiro X consideram-se as ocorrências dos meses X-1 e X (uma ocorrência de cartão cai no mês da ocorrência ou no seguinte). Só entram ocorrências elegíveis com data futura, sem lançamento gerado e sem exceção, usando método/categoria ativos hoje.
