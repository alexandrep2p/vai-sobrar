# T-04 — Infraestrutura compartilhada do backend

* **Fase:** 0 — Base técnica
* **Depende de:** T-01
* **Status:** Concluída

## Objetivo

Criar os utilitários transversais usados por todos os módulos: erros de negócio, dinheiro, datas e relógio.

## Documentos fonte

* `docs/architecture/architecture.md` — §8, §23
* `docs/specs/credit-cards.md` — §5 (somente para os tipos de data)

## Escopo

* Classe/tipo de erro de negócio com código (lista da architecture §23) e middleware Express que o serializa de forma estruturada (código, mensagem, detalhes).
* Tratamento de erros de validação Zod com formato padronizado.
* Tipo `Cents` (inteiro) e funções de conversão/validação (sem `float`).
* Tipos e utilitários de data sem horário (`LocalDate`) e de mês (`YearMonth`, formato `YYYY-MM`): comparação, soma de meses, último dia do mês.
* Relógio injetável (`Clock`) com implementação real e implementação fixa para testes.

## Fora de escopo

* Regras de negócio (ajuste de dias, ciclo etc. ficam na Fase 1).

## Critérios de aceite

* Erro de negócio lançado em um caso de uso chega ao cliente com código e status HTTP coerente.
* Nenhuma operação monetária usa ponto flutuante.
* Utilitários de data tratam corretamente anos bissextos e virada de ano.

## Testes obrigatórios

* Serialização de erro de negócio e de erro Zod.
* Conversões e validações de centavos.
* Operações de `LocalDate`/`YearMonth`, incluindo fevereiro em ano bissexto e dezembro → janeiro.
* Relógio fixo.

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

* Mapeamento código → status HTTP (a architecture §23 não define): 404 `TRANSACTION_NOT_FOUND`; 409 para conflitos com o estado atual (período fechado/pendências, não editável/deletável, fatura paga/não fechada, ocorrência não pulável, recorrência cancelada etc.); 422 para os demais. Lista em `src/shared/errors.ts`.
* Formato de erro: `{ "error": { "code", "message", "details?" } }`. Erro Zod → 400 `VALIDATION_ERROR` (details = lista de `{path, message, code}`); JSON malformado → 400 `INVALID_JSON`; erro inesperado → 500 `INTERNAL_ERROR` sem vazar a causa. Os três códigos não-de-negócio são técnicos.
* `Cents`, `LocalDate` e `YearMonth` são tipos com brand sobre `number`/`string`; datas são strings `YYYY-MM-DD`/`YYYY-MM`, sem `Date`/fuso.
* `SystemClock.today()` usa a data civil no fuso do servidor.
* Testes em `backend/tests/shared/`.
