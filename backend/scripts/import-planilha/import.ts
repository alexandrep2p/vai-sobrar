/**
 * Importação única da planilha "Controle Financeiro" (etapa 2).
 *
 * Lê o `dataset.json` gerado por `extract.py` e grava no banco do usuário informado.
 * Sem `--commit` roda tudo dentro de uma transação e desfaz no final (valida as constraints do banco).
 *
 *   npx tsx scripts/import-planilha/import.ts out/dataset.json --user-email voce@exemplo.com [--commit]
 *        [--today 2026-10-07] [--allow-existing]
 *
 * Grava direto no banco (sem passar pelos serviços) porque o histórico precisa de datas passadas,
 * valores de parcela que variam em centavos, faturas já pagas e créditos sem compra de origem.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Prisma, PrismaClient } from '@prisma/client';
import { closingDate, dueDate } from '../../src/domain/card-dates.js';
import { SystemClock } from '../../src/shared/clock.js';
import { dateInMonth, type LocalDate, type YearMonth } from '../../src/shared/dates.js';
import { seedSystemMethods } from '../../src/shared/seed.js';

// ---------------------------------------------------------------- dataset
interface Dataset {
  todayMonth: string;
  cards: { name: string; bestPurchaseDay: number; dueDay: number }[];
  categories: { name: string; type: 'INCOME' | 'EXPENSE' }[];
  cardPurchases: { card: string; month: string; description: string; amount: number; category: string }[];
  credits: { card: string; month: string; amount: number; description: string; anchor: string | null }[];
  plans: {
    card: string;
    description: string;
    category: string;
    count: number;
    startMonth: string;
    totalAmount: number;
    installments: { number: number; month: string; amount: number }[];
  }[];
  plainInstallments: { month: string; description: string; amount: number; category: string }[];
  pixItems: { month: string; description: string; amount: number; category: string }[];
  fixed: { month: string; description: string; category: string; amount: number; dueDay: number }[];
  receber: { month: string; amount: number; description: string; category: string }[];
  incomes: { month: string; description: string; amount: number; category: string }[];
  recurrences: {
    description: string;
    amount: number;
    category: string;
    method: string;
    startMonth: string;
    endMonth: string | null;
    dueDay: number;
    type: 'INCOME' | 'EXPENSE';
  }[];
  sheetCells: Record<string, number>;
}

// ---------------------------------------------------------------- argumentos
const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const datasetPath = args.find((a) => a.endsWith('.json'));
const userEmail = opt('--user-email')?.toLowerCase();
const commit = args.includes('--commit');
const allowExisting = args.includes('--allow-existing');
if (!datasetPath || !userEmail) {
  console.error('Uso: tsx scripts/import-planilha/import.ts <dataset.json> --user-email <email> [--commit]');
  process.exit(1);
}
const today = (opt('--today') ?? new SystemClock().today()) as LocalDate;
const data = JSON.parse(readFileSync(datasetPath, 'utf-8')) as Dataset;

// ---------------------------------------------------------------- utilidades
const toDb = (d: string): Date => new Date(`${d}T00:00:00.000Z`);
const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
const brl = (c: number): string =>
  (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const first = (month: string): LocalDate => dateInMonth(month as YearMonth, 1);

class DryRun extends Error {}

const prisma = new PrismaClient();

const main = async (): Promise<void> => {
  const user = await prisma.user.findFirst({ where: { email: userEmail } });
  if (!user) throw new Error(`Usuário não encontrado: ${userEmail}`);
  const userId = user.id;

  await prisma
    .$transaction(
      async (tx) => {
        const existing = await tx.transaction.count({ where: { userId } });
        if (existing > 0 && !allowExisting) {
          throw new Error(
            `O usuário já tem ${existing} lançamentos. Use --allow-existing se for intencional ` +
              '(rodar duas vezes duplica os dados).',
          );
        }

        // ---------- métodos e categorias
        await seedSystemMethods(tx, userId);
        const pix = await tx.paymentMethod.findFirstOrThrow({
          where: { userId, name: { equals: 'PIX', mode: 'insensitive' } },
        });

        const categoryId = new Map<string, string>();
        for (const c of data.categories) {
          const found = await tx.category.findFirst({
            where: { userId, name: { equals: c.name, mode: 'insensitive' } },
          });
          if (found) {
            if (found.type !== c.type) throw new Error(`Categoria "${c.name}" já existe com tipo ${found.type}.`);
            categoryId.set(c.name, found.id);
          } else {
            const created = await tx.category.create({
              data: { userId, name: c.name, type: c.type, active: true },
            });
            categoryId.set(c.name, created.id);
          }
        }
        const cat = (name: string): string => {
          const id = categoryId.get(name);
          if (!id) throw new Error(`Categoria desconhecida: ${name}`);
          return id;
        };

        interface Card {
          name: string;
          paymentMethodId: string;
          creditCardId: string;
          best: number;
          due: number;
        }
        const cards = new Map<string, Card>();
        for (const c of data.cards) {
          const method = await tx.paymentMethod.findFirst({
            where: { userId, name: { equals: c.name, mode: 'insensitive' } },
            include: { creditCard: true },
          });
          if (method?.creditCard) {
            cards.set(c.name, {
              name: c.name,
              paymentMethodId: method.id,
              creditCardId: method.creditCard.id,
              best: method.creditCard.bestPurchaseDay,
              due: method.creditCard.dueDay,
            });
            continue;
          }
          if (method) throw new Error(`"${c.name}" já existe como método que não é cartão.`);
          const pm = await tx.paymentMethod.create({
            data: { userId, name: c.name, source: 'USER', kind: 'CREDIT_CARD', active: true },
          });
          const cc = await tx.creditCard.create({
            data: { userId, paymentMethodId: pm.id, bestPurchaseDay: c.bestPurchaseDay, dueDay: c.dueDay },
          });
          cards.set(c.name, {
            name: c.name,
            paymentMethodId: pm.id,
            creditCardId: cc.id,
            best: c.bestPurchaseDay,
            due: c.dueDay,
          });
        }
        const card = (name: string): Card => {
          const c = cards.get(name);
          if (!c) throw new Error(`Cartão desconhecido: ${name}`);
          return c;
        };

        // ---------- faturas necessárias
        interface Inv {
          id: string;
          month: string;
          due: LocalDate;
          paid: boolean;
        }
        const invoices = new Map<string, Inv>();
        const need = (cardName: string, month: string): Inv => {
          const key = `${cardName}|${month}`;
          const got = invoices.get(key);
          if (got) return got;
          const c = card(cardName);
          const closing = closingDate({ bestPurchaseDay: c.best, dueDay: c.due }, month as YearMonth);
          const due = dueDate({ bestPurchaseDay: c.best, dueDay: c.due }, closing);
          const inv: Inv = { id: randomUUID(), month, due, paid: month < data.todayMonth };
          invoices.set(key, inv);
          return inv;
        };
        for (const p of data.cardPurchases) need(p.card, p.month);
        for (const p of data.plans) for (const i of p.installments) need(p.card, i.month);
        for (const c of data.credits) need(c.card, c.month);

        const invoiceRows: Prisma.InvoiceCreateManyInput[] = [];
        for (const [key, inv] of invoices) {
          const cardName = key.split('|')[0] as string;
          const c = card(cardName);
          const closing = closingDate({ bestPurchaseDay: c.best, dueDay: c.due }, inv.month as YearMonth);
          invoiceRows.push({
            id: inv.id,
            userId,
            creditCardId: c.creditCardId,
            referenceMonth: inv.month,
            closingDate: toDb(closing),
            dueDate: toDb(inv.due),
            status: inv.paid ? 'PAID' : closing < today ? 'CLOSED' : 'OPEN',
            paidAt: inv.paid ? toDb(inv.due) : null,
            paymentMethodId: inv.paid ? pix.id : null,
          });
        }
        await tx.invoice.createMany({ data: invoiceRows });

        // ---------- lançamentos
        const txRows: Prisma.TransactionCreateManyInput[] = [];
        const cardTxs: { id: string; card: string; month: string; description: string; amount: number }[] = [];

        const cardTx = (
          cardName: string,
          month: string,
          description: string,
          amount: number,
          category: string,
          origin: 'CREDIT_CARD' | 'INSTALLMENT',
          purchaseDate: LocalDate,
        ): string => {
          const inv = need(cardName, month);
          const id = randomUUID();
          txRows.push({
            id,
            userId,
            description: description.slice(0, 200),
            amount,
            financialMonth: month,
            dueDate: toDb(inv.due),
            paidAt: inv.paid ? toDb(inv.due) : null,
            status: inv.paid ? 'PAID' : 'PENDING',
            categoryId: cat(category),
            paymentMethodId: card(cardName).paymentMethodId,
            origin,
            purchaseDate: toDb(purchaseDate),
            invoiceId: inv.id,
          });
          cardTxs.push({ id, card: cardName, month, description, amount });
          return id;
        };

        const plainTx = (month: string, description: string, amount: number, category: string, day = 1): void => {
          const due = dateInMonth(month as YearMonth, day);
          const paid = month < data.todayMonth;
          txRows.push({
            id: randomUUID(),
            userId,
            description: description.slice(0, 200),
            amount,
            financialMonth: month,
            dueDate: toDb(due),
            paidAt: paid ? toDb(due) : null,
            status: paid ? 'PAID' : 'PENDING',
            categoryId: cat(category),
            paymentMethodId: pix.id,
            origin: 'MANUAL',
          });
        };

        for (const p of data.cardPurchases) {
          cardTx(p.card, p.month, p.description, p.amount, p.category, 'CREDIT_CARD', first(p.month));
        }

        const planRows: Prisma.InstallmentPlanCreateManyInput[] = [];
        const installmentRows: Prisma.InstallmentCreateManyInput[] = [];
        for (const p of data.plans) {
          const planId = randomUUID();
          const purchase = first(p.startMonth);
          planRows.push({
            id: planId,
            userId,
            creditCardId: card(p.card).creditCardId,
            totalAmount: p.totalAmount,
            installmentCount: p.count,
            purchaseDate: toDb(purchase),
          });
          for (const i of p.installments) {
            const txId = cardTx(p.card, i.month, p.description, i.amount, p.category, 'INSTALLMENT', purchase);
            installmentRows.push({ id: randomUUID(), userId, installmentPlanId: planId, transactionId: txId, number: i.number });
          }
        }

        for (const p of data.pixItems) plainTx(p.month, p.description, p.amount, p.category);
        for (const p of data.plainInstallments) plainTx(p.month, p.description, p.amount, p.category);
        for (const f of data.fixed) plainTx(f.month, f.description, f.amount, f.category, f.dueDay);
        for (const r of data.receber) plainTx(r.month, r.description, r.amount, r.category);
        for (const i of data.incomes) plainTx(i.month, i.description, i.amount, i.category);

        await tx.installmentPlan.createMany({ data: planRows });
        await tx.transaction.createMany({ data: txRows });
        await tx.installment.createMany({ data: installmentRows });

        // ---------- créditos / estornos (Refund + RefundAllocation)
        const refundRows: Prisma.RefundCreateManyInput[] = [];
        const allocationRows: Prisma.RefundAllocationCreateManyInput[] = [];
        for (const c of data.credits) {
          const inv = need(c.card, c.month);
          const refundDate = first(c.month);
          const candidates = cardTxs.filter((t) => t.card === c.card && t.month <= c.month);
          let allocations: { id: string; amount: number }[] = [];
          const anchored = c.anchor
            ? candidates
                .filter((t) => norm(t.description).includes(norm(c.anchor as string)) && t.amount >= c.amount)
                .sort((a, b) => b.month.localeCompare(a.month))[0]
            : undefined;
          if (anchored) {
            allocations = [{ id: anchored.id, amount: c.amount }];
          } else {
            // crédito sem compra de origem: distribui entre os lançamentos da própria fatura
            let left = c.amount;
            for (const t of candidates.filter((x) => x.month === c.month).sort((a, b) => b.amount - a.amount)) {
              if (left === 0) break;
              const take = Math.min(t.amount, left);
              allocations.push({ id: t.id, amount: take });
              left -= take;
            }
            if (left > 0) throw new Error(`Crédito "${c.description}" sem lançamentos suficientes na fatura.`);
          }
          const refundId = randomUUID();
          refundRows.push({
            id: refundId,
            userId,
            transactionId: allocations[0]!.id,
            amount: c.amount,
            refundDate: toDb(refundDate),
          });
          for (const a of allocations) {
            allocationRows.push({
              id: randomUUID(),
              userId,
              refundId,
              transactionId: a.id,
              amount: a.amount,
              invoiceId: inv.id,
            });
          }
        }
        await tx.refund.createMany({ data: refundRows });
        await tx.refundAllocation.createMany({ data: allocationRows });

        // ---------- recorrências (a partir do mês seguinte ao corrente)
        for (const r of data.recurrences) {
          const method = r.method === 'PIX' ? pix : { id: card(r.method).paymentMethodId };
          const endDate = r.endMonth
            ? toDb(dateInMonth(r.endMonth as YearMonth, 28)) // fim: dentro do último mês
            : null;
          await tx.recurrence.create({
            data: {
              userId,
              description: r.description,
              amount: r.amount,
              categoryId: cat(r.category),
              paymentMethodId: method.id,
              dueDay: r.dueDay,
              startDate: toDb(first(r.startMonth)),
              endDate,
              status: 'ACTIVE',
            },
          });
        }

        // ---------- resumo e conferência
        const debit = new Map<string, number>();
        for (const t of cardTxs) debit.set(`${t.card}|${t.month}`, (debit.get(`${t.card}|${t.month}`) ?? 0) + t.amount);
        for (const a of allocationRows) {
          const inv = [...invoices.entries()].find(([, v]) => v.id === a.invoiceId);
          if (inv) debit.set(inv[0], (debit.get(inv[0]) ?? 0) - a.amount);
        }
        let worst = 0;
        for (const [key, cell] of Object.entries(data.sheetCells)) {
          const month = key.split('|')[1] as string;
          if (month > data.todayMonth) continue;
          worst = Math.max(worst, Math.abs((debit.get(key) ?? 0) - cell));
        }
        console.log(`Usuário ................ ${userEmail}`);
        console.log(`Hoje ................... ${today}`);
        console.log(`Categorias ............. ${categoryId.size}`);
        console.log(`Cartões ................ ${cards.size}`);
        console.log(`Faturas ................ ${invoiceRows.length}`);
        console.log(`Planos / parcelas ...... ${planRows.length} / ${installmentRows.length}`);
        console.log(`Lançamentos (total) .... ${txRows.length}`);
        console.log(`Estornos/créditos ...... ${refundRows.length} (${allocationRows.length} alocações)`);
        console.log(`Recorrências ........... ${data.recurrences.length}`);
        console.log(`Maior diferença fatura x célula: R$ ${brl(worst)}`);

        if (!commit) throw new DryRun();
      },
      { maxWait: 30_000, timeout: 300_000 },
    )
    .catch((error: unknown) => {
      if (error instanceof DryRun) {
        console.log('\nSimulação concluída: nada foi gravado (use --commit para gravar).');
        return;
      }
      throw error;
    });
  if (commit) console.log('\nImportação gravada.');
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
