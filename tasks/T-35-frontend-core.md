# T-35 — Base do frontend

* **Fase:** 4 — Frontend
* **Depende de:** T-03
* **Status:** Concluída

## Objetivo

Criar a base compartilhada das telas.

## Documentos fonte

* `docs/architecture/architecture.md` — §5
* `docs/domain/domain-model.md` — §5

## Escopo

* Layout principal e navegação (Home, Faturas, Recorrências, Categorias, Métodos, Cartões).
* Cliente HTTP com tratamento padronizado dos erros de negócio (código → mensagem em português).
* Formatação de dinheiro (centavos → R$) e datas.
* Tradução dos enums para as labels da domain-model §5.

## Fora de escopo

* Telas de negócio.

## Critérios de aceite

* Navegação funcional entre as rotas.
* Erro de negócio da API é exibido com mensagem amigável.

## Testes obrigatórios

* Testes unitários das formatações e do mapeamento de labels e de erros.

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

* Biblioteca de componentes: **Angular Material 22** (MIT, gratuita, acompanha o Angular), tema pré-construído **Azure & Blue** (`@angular/material/prebuilt-themes/azure-blue.css`, tokens `--mat-sys-*`), fontes Roboto e Material Icons via Google Fonts em `index.html`. Sem modo escuro por ora.
* Histórico: a primeira versão da T-35 usou PrimeNG 22, abandonado porque a v22 exige license key (banner "Invalid PrimeUI License"; a v21 MIT não suporta Angular 22). Substituído por Angular Material; `primeng`, `@primeuix/themes` e `primeicons` foram removidos.
* **Mobile first**: CSS base para telas pequenas e ampliação com `min-width` (breakpoint 768px). Mobile: barra superior (`mat-toolbar`) com menu em gaveta (`mat-sidenav` modo `over`); a partir de 768px: `mat-sidenav` fixo (modo `side`), alternado por `BreakpointObserver`.
* Rotas em português (`/home`, `/faturas`, `/recorrencias`, `/categorias`, `/metodos`, `/cartoes`), com `loadComponent` e páginas provisórias em `features/*` a serem substituídas nas tasks de tela.
* Erros: `ApiClient` (`core/api`) usa URLs relativas `/api`; `errorInterceptor` converte `HttpErrorResponse` em `ApiError` (código + mensagem em português de `error-messages.ts`, ignorando o texto interno do backend, conforme architecture §23) e mostra um snackbar (`MatSnackBar`). Códigos desconhecidos usam mensagem genérica.
* Dinheiro: `formatCents` (centavos → R$, sem cálculo de domínio). Datas: `formatDate`/`formatMonth` tratam `YYYY-MM-DD`/`YYYY-MM` como texto, sem fuso horário. Labels dos enums em `shared/labels/labels.ts`.
* Orçamento de bundle inicial: aviso elevado de 500kB para 700kB (o inicial ficou com ~590kB raw / ~133kB transferidos, por causa de Angular Material + CDK).
* Infra compartilhada das telas (T-36 em diante): `core/api/models.ts` (tipos dos DTOs), `core/data/catalog.service.ts` e `ledger.service.ts` (chamadas da API), `core/clock.ts` ("hoje" injetável), `shared/ui` (`LoadState`, `ConfirmDialog`, `PayDialog`, `dialogConfig`), `shared/forms/validators.ts` e `parseCents` (texto → centavos sem ponto flutuante). Formulários em `MatDialog` com largura total no mobile.
