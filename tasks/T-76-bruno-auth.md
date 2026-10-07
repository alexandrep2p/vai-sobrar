# T-76 — Collection do Bruno com autenticação

* **Fase:** 5 — Validação transversal
* **Depende de:** T-72
* **Status:** Concluída

## Objetivo

Manter a collection do Bruno executável com a API protegida.

## Documentos fonte

* `docs/decisions/business-decisions.md` (PD-41)
* `docs/specs/auth.md`
* `bruno/README.md`

## Escopo

* Pasta `00-autenticacao` (cadastro, login guardando o cookie, me, conta, logout).
* Cookie enviado em todas as requisições da collection.

## Fora de escopo

* Mudanças na API.

## Critérios de aceite

* Collection inteira executa sem falhas contra banco limpo.

## Testes obrigatórios

* Execução pelo Bruno CLI.

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

* Pasta `00 - Autenticacao` (cadastro, entrar, usuário conectado, editar perfil) e pasta final `10 - Conta e sessao` (trocar senha, sair, 401 sem sessão, entrar com a nova senha, excluir conta). O login guarda o cookie `vs_session` em `sessionCookie` por script; a collection envia `Cookie: {{sessionCookie}}` em todas as requisições. Senhas de teste nas variáveis `password`/`newPassword` da collection.
* Corrigido defeito anterior: "Apagar compra parcelada" (pasta 05) apagava o plano usado depois pelo estorno da pasta 07; agora apaga uma compra parcelada própria (`planToDeleteId`).
* Bruno CLI: 67 requisições, 65 asserções, todas passando (o fechamento de mês continua retornando 409 de propósito).
