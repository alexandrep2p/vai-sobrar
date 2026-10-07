# T-70 — Dados separados por usuário

* **Fase:** 3 — API do backend
* **Depende de:** T-69
* **Status:** Concluída

## Objetivo

Tornar todos os dados financeiros pertencentes a um usuário e exigir sessão em toda a API.

## Documentos fonte

* `docs/decisions/business-decisions.md` (PD-41)
* `docs/specs/auth.md`
* `docs/architecture/architecture.md` §7, §12, §20 e §22
* `docs/specs/payment-methods.md` §3

## Escopo

* Migration: descarta os dados atuais, adiciona `user_id` às 12 tabelas de negócio, unicidades por usuário.
* Cliente Prisma restrito ao usuário (`shared/tenant.ts`) e contexto por request.
* Criações com `user_id`; SQL cru da fatura; locks de meses por usuário.
* Métodos do sistema criados no cadastro (não mais na partida do servidor).
* Atualização de estado e rotina periódica por usuário; marca d'água por usuário.
* `requireAuth` em todo `/api`; helpers de teste com usuário e cookie; suíte existente verde.

## Fora de escopo

* Testes de isolamento entre usuários (T-71).

## Critérios de aceite

* Suíte existente passando com usuário autenticado.
* CA-AUTH-07 e CA-AUTH-11.

## Testes obrigatórios

* Suíte de integração existente adaptada; métodos do sistema por conta.

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

* Migration `tenancy_user_id` gerada com `prisma migrate diff` (o `migrate dev` exige confirmação interativa por perda de dados): `TRUNCATE` das tabelas de negócio e `job_states`, `user_id` + FK + índice nas 12 tabelas, `financial_periods (user_id, reference_month)` único, índices `(user_id, financial_month)` em transactions e `(user_id, reference_month)` em invoices, nomes únicos `(user_id, lower(name))` em categories e payment_methods.
* `shared/tenant.ts`: `scopedPrisma(base, userId)` (extensão `query.$allModels.$allOperations`) injeta `userId` por espalhamento no `where` (preserva seletores únicos) e no `data` das criações; `userId` divergente ou operação desconhecida lançam `TenantScopeError`. O membro `$tenantId` (via `client`) chega às transações interativas e é lido por `tenantIdOf(db)`.
* Contexto: `BaseContext { prisma, clock }` e `AppContext extends BaseContext { userId }`; `requireAuth` preenche `req.ctx = tenantContext(base, userId)`; routers sem argumentos, cada handler usa `ctxOf(req)`.
* Criações passam `userId` explicitamente (o schema torna obrigatório; o compilador apontou todos os pontos), inclusive as alocações aninhadas do estorno. O `INSERT` cru da fatura obtém o `user_id` do cartão.
* Locks de meses com chave `periods:<userId>`; marca d'água e lock da geração de ocorrências por usuário. `startBackgroundJobs` percorre os usuários (`refreshAllUsers`), isolando falhas.
* Métodos do sistema criados no cadastro (`seedSystemMethods(db, userId)`), não mais na partida; `prisma/seed.ts` só completa contas existentes.
* Testes: `setupEnv` cria usuário (hash calculado uma vez por processo), métodos e sessão; `Api` envia o cookie; `env.ctx` substitui contextos montados à mão; `constraints.int.spec` usa cliente restrito.
