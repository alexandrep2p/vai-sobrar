# Collection do Bruno — Vai Sobrar API

Collection com todos os endpoints do backend (53 requisições, 10 pastas), pronta para o [Bruno](https://www.usebruno.com/).

## Como abrir

1. No Bruno: **Open Collection** e selecione a pasta `bruno/vai-sobrar-api`.
2. Escolha o ambiente **Local** (canto superior direito). Ele só define `baseUrl = http://localhost:3000`.

## Antes de testar

Na raiz do repositório, suba o banco e o servidor:

```bash
docker compose up -d
```

```bash
cd backend
npm run prisma:migrate
npm run dev
```

(`prisma:migrate` só é necessário na primeira vez, ou depois de novas migrations. O servidor cria PIX, Dinheiro e Débito sozinho.)

## Como usar

- Rode as pastas **na ordem numérica** (ou a collection inteira no **Runner**). Cada requisição guarda os ids que retorna em variáveis (`categoryId`, `cardId`, `cardMethodId`, `transactionId`, `invoiceId`, `planId`, `recurrenceId`...) e as seguintes as usam.
- As **datas são calculadas a cada requisição** a partir do relógio do seu computador (`today`, `currentMonth`, `nextMonth`...), porque o backend usa a data real como "hoje" (por exemplo, compras retroativas só são aceitas no mês corrente).
- Os nomes levam o sufixo `{{runId}}` para que a collection possa rodar mais de uma vez sem colidir com nomes já existentes. Para "zerar" o sufixo, apague a variável `runId` (ou reinicie o Bruno).
- Valores em dinheiro são **centavos** (`150000` = R$ 1.500,00).
- As respostas de erro seguem `{ "error": { "code", "message", "details" } }`.

## O que esperar no fluxo completo

Uma requisição retorna `409` **de propósito** quando a collection roda do início ao fim, porque depende do estado do mês:

| Requisição                                         | Por quê                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| `09 - Extrato e meses / Fechar mes (IRREVERSIVEL)` | O mês tem lançamentos em aberto (`PERIOD_HAS_PENDING_TRANSACTIONS`). |

`Pagar fatura` funciona com a fatura aberta ou fechada (PD-32). Para ver o fechamento do mês funcionando, pague antes o que estiver pendente: lançamentos de método comum (`Pagar lancamento`) e as faturas do cartão.

> **Cuidado:** `Fechar mes` é irreversível. Depois de fechado, o mês (e as faturas daquele mês) ficam imutáveis. Para desfazer em ambiente de desenvolvimento, recrie o banco (`npm run db:reset` na pasta `backend`).

## Executar pela linha de comando (opcional)

```bash
cd bruno/vai-sobrar-api
npx @usebruno/cli run --env Local -r
```

## Mapa dos endpoints

| Pasta                     | Endpoints                                                                                                                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00 - Saude                | `GET /health`                                                                                                                                                                                                  |
| 01 - Categorias           | `GET/POST /api/categories`, `PUT /api/categories/:id`, `POST .../activate`, `POST .../deactivate`                                                                                                              |
| 02 - Metodos de pagamento | `GET/POST /api/payment-methods`, `PUT /api/payment-methods/:id`, `POST .../activate`, `POST .../deactivate`                                                                                                    |
| 03 - Cartoes              | `GET/POST /api/credit-cards`, `GET/PUT /api/credit-cards/:id`, `POST .../activate`, `POST .../deactivate`                                                                                                      |
| 04 - Lancamentos          | `GET/POST /api/transactions` (manual, cartão à vista e parcelado), `GET/PUT/DELETE /api/transactions/:id`, `POST .../pay`, `POST .../unpay`                                                                    |
| 05 - Parcelamentos        | `GET/PUT /api/installment-plans/:id`, `GET .../refunds`                                                                                                                                                        |
| 06 - Faturas              | `GET /api/credit-cards/:id/invoices`, `GET /api/invoices/:id`, `POST /api/invoices/:id/pay`                                                                                                                    |
| 07 - Estornos             | `POST /api/refunds`, `GET /api/refunds/:id`, `GET /api/transactions/:id/refunds`                                                                                                                               |
| 08 - Recorrencias         | `GET/POST /api/recurrences`, `GET/PUT /api/recurrences/:id`, `POST .../pause`, `.../resume`, `.../cancel`, `PUT .../occurrences/:month`, `POST .../occurrences/:month/pay`, `POST .../occurrences/:month/skip` |
| 09 - Extrato e meses      | `GET /api/monthly-statement?month=`, `GET /api/financial-periods/:month`, `POST .../close`                                                                                                                     |
