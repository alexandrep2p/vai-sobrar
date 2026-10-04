# Frontend — Vai Sobrar

Angular 22 (standalone, signals, Vitest) com **Angular Material** (tema Azure & Blue). Interface **mobile first**: o CSS base vale para telas pequenas e o layout cresce com `min-width` (breakpoint de 768px). Arquitetura em `docs/architecture/architecture.md` §5; decisões técnicas nas tasks T-03 e T-35.

O frontend apenas exibe o que o backend retorna: não calcula saldo, fatura, ciclo, parcelas, estornos, elegibilidade de recorrência nem pré-condições de fechamento.

## Estrutura

```text
src/app/
├── core/        base da aplicação
│   ├── api/       ApiClient, ApiError, mensagens de erro em português e interceptor (snackbar)
│   ├── data/      serviços de dados (CatalogService, LedgerService) e tipos em api/models.ts
│   ├── layout/    shell (barra superior no mobile, menu lateral no desktop) e itens de navegação
│   └── clock.ts   "hoje" injetável (usado nos padrões de data e nos testes)
├── shared/      reutilizáveis
│   ├── format/    dinheiro (centavos ↔ R$) e datas, sem fuso horário
│   ├── forms/     validadores (valor, texto)
│   ├── labels/    labels em português dos enums (domain-model §5)
│   └── ui/        LoadState, ConfirmDialog, PayDialog e config padrão de diálogos
├── features/    uma pasta por tela, com diálogos próprios
│   ├── home/  invoices/  recurrences/  categories/  payment-methods/  credit-cards/
└── app.routes.ts  rotas (/home, /faturas, /recorrencias, /categorias, /metodos, /cartoes)
src/testing/     helpers e fixtures usados só nos testes
```

## Como rodar

O frontend precisa do backend e do banco no ar. Na primeira vez, siga a seção "Como rodar" do [README do backend](../backend/README.md) (Docker, `.env`, migrations). Depois, em três terminais:

```bash
# raiz do repositório
docker compose up -d
```

```bash
# backend/
npm run dev
```

```bash
# frontend/
npm install
npm start
```

A aplicação abre em `http://localhost:4200`.

### API em desenvolvimento

O `ng serve` usa o proxy `proxy.conf.json`, que encaminha `/api` para `http://localhost:3000`. O código sempre chama URLs relativas (`/api/...`); para apontar para outro backend em desenvolvimento, altere o `target` desse arquivo. Em produção, o servidor web deve fazer o mesmo encaminhamento de `/api`.

## Scripts

| Script          | O que faz                                                                        |
| --------------- | -------------------------------------------------------------------------------- |
| `npm start`     | servidor de desenvolvimento (`ng serve`) com proxy para a API                    |
| `npm run build` | build de produção em `dist/frontend`                                             |
| `npm run watch` | build em modo watch (configuração de desenvolvimento)                            |
| `npm test`      | testes unitários e de componente (Vitest); `-- --watch=false` para rodar uma vez |

Verificações adicionais usadas no projeto:

```bash
npx prettier --check src     # formatação
npx tsc --noEmit -p tsconfig.app.json   # tipos do app
npx tsc --noEmit -p tsconfig.spec.json  # tipos dos testes
```

## Testes

Os testes de componente usam serviços simulados (sem backend). Testes ponta a ponta no navegador ainda não existem. Em testes, o "hoje" vem de `Clock` (substitua-o por um valor fixo) e os diálogos são testados criando o componente diretamente com `MAT_DIALOG_DATA` e `MatDialogRef` simulados (ver `src/testing/helpers.ts`).

## Convenções

- Valores monetários sempre em **centavos inteiros**; texto digitado é convertido por `parseCents` e exibido por `formatCents`.
- Datas da API (`YYYY-MM-DD`, `YYYY-MM`) são tratadas como texto, nunca via `Date`/fuso.
- Erros da API viram `ApiError` com mensagem em português, a partir do **código** (nunca do texto interno do backend), e são exibidos em snackbar pelo interceptor.
- Telas novas: CSS mobile first (base para telas pequenas, `@media (min-width: 768px)` para ampliar); estados de carregando, vazio e erro com nova tentativa via `app-load-state`.
