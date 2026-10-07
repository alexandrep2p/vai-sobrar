# T-66 — Modo escuro

* **Fase:** 4 — Frontend
* **Depende de:** T-65
* **Status:** Concluída

## Objetivo

Oferecer tema escuro, alternado por um botão no canto superior direito (PD-40).

## Documentos fonte

* `docs/decisions/business-decisions.md` (PD-40)
* `docs/architecture/architecture.md` §2

## Escopo

* Botão no canto superior direito (mobile e desktop): ícone de lua no tema claro, de sol no escuro.
* Sem escolha, o tema segue o do sistema; a escolha do botão é lembrada no navegador.
* Telas e estilos próprios legíveis nos dois temas (tokens `--tui-*`).

## Fora de escopo

* Sincronizar a preferência entre aparelhos; outros temas além de claro e escuro.

## Critérios de aceite

* No tema claro o botão mostra a lua e, ao clicar, o app fica escuro (e vice-versa com o sol).
* Ao recarregar, o tema escolhido se mantém.
* Sem escolha salva, o app abre no tema do sistema.

## Testes obrigatórios

* Shell: ícone conforme o tema e alternância ao clicar.

## Regras para o agente

* Implemente **somente** o escopo desta task.
* As regras vêm exclusivamente dos documentos fonte listados. Não invente regras.
* Se encontrar ambiguidade ou contradição nos documentos, **interrompa** aquela parte, descreva a dúvida e peça definição (`architecture.md` §24).

## Definição de pronto

* Critérios de aceite atendidos.
* Testes obrigatórios escritos e passando.
* Build sem erros.
* Nenhuma regra de negócio nova ou divergente da documentação.

## Decisões técnicas registradas

* Usa o `TUI_DARK_MODE` do Taiga: sem escolha segue `prefers-color-scheme` (e acompanha a mudança do sistema); `set()` grava a escolha em `localStorage['tuiDark']`. O `provideTaiga()` ficou sem `mode`, porque `mode` fixaria o tema.
* `index.html` aplica `tuiTheme="dark"` no `body` antes do Angular iniciar, para não piscar claro.
* A barra superior do shell agora existe também no desktop, na coluna do conteúdo, só com o botão de tema. No mobile ela continua com o menu e o título. O botão é `tuiIconButton` com `@tui.moon` / `@tui.sun` e texto acessível "Ativar modo escuro/claro".
* `color-scheme: dark` no `body` escuro, para os controles nativos (data, mês, rolagem).
* `test-setup.ts`: `localStorage` em memória, porque o Node oculta o do jsdom.
* Quem abriu as versões T-60 a T-65 desta branch tem `tuiDark=false` salvo (efeito do antigo `mode: 'light'`) e abre claro até usar o botão.
* Verificado no navegador (desktop e 375px): lua → escuro → sol, escolha mantida ao recarregar, Home, diálogos e recorrências legíveis no escuro.
