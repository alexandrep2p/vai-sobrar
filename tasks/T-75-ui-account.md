# T-75 — Tela Minha conta

* **Fase:** 4 — Frontend
* **Depende de:** T-72, T-74
* **Status:** Concluída

## Objetivo

Tela para editar perfil, trocar senha e excluir conta.

## Documentos fonte

* `docs/decisions/business-decisions.md` (PD-41)
* `docs/specs/auth.md` §8 e §10

## Escopo

* Página `/conta` com as seções perfil, trocar senha (com checklist) e excluir conta (diálogo com senha).

## Fora de escopo

* Alterar email.

## Critérios de aceite

* CA-AUTH-12..14 na interface.

## Testes obrigatórios

* Página Minha conta.

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

* `AccountPage` (`/conta`): perfil (email somente leitura, salvar só após alteração), trocar senha (checklist, senha atual errada no campo) e excluir conta (`DeleteAccountDialog` com aviso de irreversibilidade e senha).
* Verificado no navegador: perfil salvo com espaços normalizados, cookie invisível ao JavaScript (`document.cookie` vazio), exclusão da conta de teste apagou usuário, sessões e métodos no banco.
