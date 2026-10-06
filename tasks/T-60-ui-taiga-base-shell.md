# T-60 — Base Taiga UI e shell

* **Fase:** 4 — Frontend
* **Depende de:** T-35
* **Status:** Concluída

## Objetivo

Instalar o Taiga UI e migrar a base do app (raiz, shell de navegação, notificação de erro e estilos globais) do Angular Material para o Taiga UI, convivendo temporariamente com o Material.

## Documentos fonte

* `docs/architecture/architecture.md` — stack do frontend
* Documentação do Taiga UI (MCP `taiga-ui`)

## Escopo

* Instalar `@taiga-ui/{cdk,core,kit,icons,layout}` e `less`; estilos `.less` e assets de ícones no `angular.json`.
* `provideTaiga()` em `app.config.ts` e `<tui-root>` em `app.html`.
* Shell (`core/layout/*`) com componentes Taiga; ícones Lucide em `nav-items.ts`; breakpoint via `matchMedia` (sem `@angular/cdk`).
* Interceptor de erro com `TuiNotificationService` no lugar do `MatSnackBar`.
* Tokens globais de `styles.css` convertidos de `--mat-sys-*` para `--tui-*`.
* `architecture.md`: frontend passa a citar Taiga UI.

## Fora de escopo

* Telas de negócio e diálogos (T-61 a T-64); remoção do Material (T-65).

## Critérios de aceite

* Navegação lateral fixa no desktop e gaveta no mobile, com os mesmos itens e rotas.
* Erro de API exibe notificação com a mensagem em português.
* Build e testes existentes passando.

## Testes obrigatórios

* Shell: itens de navegação, link ativo e abertura/fechamento no mobile.
* Interceptor: notificação aberta com a mensagem do erro.

## Regras para o agente

* Implemente **somente** o escopo desta task.
* Troca de biblioteca de componentes: nenhuma regra de negócio muda. Comportamento e textos permanecem os mesmos.
* Se encontrar ambiguidade ou contradição nos documentos, **interrompa** aquela parte, descreva a dúvida e peça definição (`architecture.md` §24).
* Valores monetários sempre em centavos inteiros.

## Definição de pronto

* Critérios de aceite atendidos.
* Testes obrigatórios escritos e passando.
* Build sem erros.
* Nenhuma regra de negócio nova ou divergente da documentação.

## Decisões técnicas registradas

* Taiga UI 5.27 (`cdk`, `core`, `kit`, `icons`, `layout`) e `less` (os estilos do Taiga são `.less`). Ícones servidos de `node_modules/@taiga-ui/icons/src` em `assets/taiga-ui/icons`.
* `provideTaiga({ mode: 'light' })`: o app não tem modo escuro, então o tema não segue o sistema operacional.
* Shell próprio em CSS (grid no desktop, gaveta `position: fixed` com backdrop no mobile), com `tuiIconButton` e `tui-icon`. O `BreakpointObserver` do CDK virou um signal sobre `matchMedia`. Esc fecha a gaveta; quando fechada, ela fica `inert`.
* Erros de API viram `TuiNotificationService.open(msg, { appearance: 'negative', autoClose: 6000 })`.
* `src/test-setup.ts` (registrado em `setupFiles` do teste) com polyfills de `matchMedia` e `ResizeObserver` para o jsdom.
* Enquanto as duas libs convivem, o tema pré-compilado do Material, Roboto, Material Icons e as regras `.destructive`, `.mat-*` e `mat-form-field` do `styles.css` continuam. Eles saem na T-65.
* Verificado no navegador (desktop e 375px): navegação, link ativo, gaveta mobile abre, navega e fecha.
