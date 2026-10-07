# T-74 — Telas de login e cadastro

* **Fase:** 4 — Frontend
* **Depende de:** T-73
* **Status:** Concluída

## Objetivo

Telas de login e cadastro com validação e checklist de senha.

## Documentos fonte

* `docs/decisions/business-decisions.md` (PD-41)
* `docs/specs/auth.md` §4–§6 e §10
* `docs/decisions/business-decisions.md` (PD-37)

## Escopo

* Validadores de nome, username, senha e confirmação.
* Componente de checklist da senha.
* Páginas de login e cadastro, mobile first; erros do servidor no próprio formulário.

## Fora de escopo

* Recuperação de senha.

## Critérios de aceite

* CA-AUTH-01..06 na interface.

## Testes obrigatórios

* Validadores, checklist, páginas de login e cadastro.

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

* `shared/forms/auth-validators.ts` espelha as regras do backend (`passwordChecks`, `strongPassword`, `fullName`, `usernameFormat`, `matchFields`).
* `PasswordChecklist` com ícone por requisito e `aria-live`. Campos com `subscriptSizing="dynamic"` para as mensagens quebrarem linha no celular; espaço entre campos por margem.
* Erros do servidor: `EMAIL_TAKEN`/`USERNAME_TAKEN` no campo; demais no topo do formulário. Email do cadastro vai ao login pelo `state` da navegação (nunca pela URL).
* Verificado no navegador: checklist ao vivo, cadastro → login com email preenchido, senha errada com mensagem genérica, login → Home vazia e só PIX/Dinheiro/Débito.
