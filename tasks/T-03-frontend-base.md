# T-03 — Revisar a estrutura do frontend

* **Fase:** 0 — Base técnica
* **Depende de:** —
* **Status:** A fazer

## Estado atual

Já existe um projeto Angular 22 criado pelo CLI (standalone, Vitest).

## Objetivo

Validar e ajustar o projeto Angular 22 já criado para servir de base às telas.

## Documentos fonte

* `docs/architecture/architecture.md` — §2, §5

## Escopo

* Confirmar que `ng serve`, `ng build` e `ng test` funcionam.
* Definir a organização de pastas (`core/`, `shared/`, `features/`).
* Configurar o endereço da API por ambiente (proxy de desenvolvimento para o backend).
* Remover o conteúdo de exemplo gerado pelo CLI.

## Fora de escopo

* Telas e componentes de negócio.
* Biblioteca de componentes (decisão aberta; registrar se escolhida).

## Critérios de aceite

* Projeto compila e os testes padrão passam.
* Chamadas para `/api` são encaminhadas ao backend em desenvolvimento.

## Testes obrigatórios

* Teste do componente raiz atualizado.

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
