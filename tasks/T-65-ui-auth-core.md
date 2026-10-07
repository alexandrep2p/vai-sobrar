# T-65 — Núcleo de autenticação (frontend)

* **Fase:** 4 — Frontend
* **Depende de:** T-61
* **Status:** Concluída

## Objetivo

Estado do usuário, proteção das rotas e tratamento de sessão no frontend.

## Documentos fonte

* `docs/decisions/business-decisions.md` (PD-40)
* `docs/specs/auth.md` §10

## Escopo

* `core/auth`: store, service, `authGuard` e `guestGuard`.
* Rotas `/login`, `/cadastro` (fora do Shell) e Shell protegido.
* Interceptor: 401 → login, sem snackbar; mensagens dos novos códigos.
* Shell: nome, username, "Minha conta" e "Sair".

## Fora de escopo

* Telas de login/cadastro (T-66) e Minha conta (T-67).

## Critérios de aceite

* CA-AUTH-07 na interface.

## Testes obrigatórios

* Guards, service, interceptor (401) e Shell.

## Regras para o agente

* Implemente **somente** o escopo desta task.
* As regras de negócio vêm exclusivamente dos documentos fonte listados. Não invente regras.
* Se encontrar ambiguidade ou contradição nos documentos, **interrompa** aquela parte, descreva a dúvida e peça definição (`architecture.md` §24).
* Valores monetários sempre em centavos inteiros.

## Definição de pronto

* Critérios de aceite atendidos.
* Testes obrigatórios escritos e passando.
* Build sem erros.
* Nenhuma regra de negócio nova ou divergente da documentação.

## Decisões técnicas registradas

* `core/auth`: `AuthStore` (signal sem HTTP, usado pelo interceptor), `AuthService` (`loadMe`/`ensureLoaded`, login, cadastro, logout, perfil, senha, exclusão) e guards funcionais `authGuard`/`guestGuard`; `safeReturnUrl` aceita só caminhos internos.
* `ApiClient` ganhou `RequestOptions.silent` (`HttpContextToken SILENT_ERROR`) e corpo no `DELETE`. Interceptor: `UNAUTHENTICATED` limpa o usuário e leva a `/login?returnUrl=...` sem snackbar, exceto a consulta `GET /auth/me`.
* Shell: nome, @username, "Minha conta" (`mat-nav-list`) e "Sair" (`mat-action-list`).
* Verificado no navegador (375px): rota protegida → login com destino; menu com usuário.
