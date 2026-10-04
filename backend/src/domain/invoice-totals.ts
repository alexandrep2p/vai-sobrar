import { cents, type Cents } from '../shared/money.js';

export interface InvoiceTotalsInput {
  /** `amount` dos lançamentos postados na fatura. */
  debits: readonly Cents[];
  /** `amount` das alocações de estorno reconhecidas na fatura. */
  credits: readonly Cents[];
  /** `credit_balance` das faturas `PAID` transferidas para esta. */
  receivedCredits: readonly Cents[];
}

export interface InvoiceTotals {
  debits: Cents;
  credits: Cents;
  receivedCredit: Cents;
  amountDue: Cents;
  creditBalance: Cents;
}

const sum = (values: readonly Cents[]): Cents => cents(values.reduce((acc, v) => acc + v, 0));

/** invoices.md §7–§8. */
export const invoiceTotals = (input: InvoiceTotalsInput): InvoiceTotals => {
  const debits = sum(input.debits);
  const credits = sum(input.credits);
  const receivedCredit = sum(input.receivedCredits);
  const net = debits - credits - receivedCredit;
  return {
    debits,
    credits,
    receivedCredit,
    amountDue: cents(Math.max(0, net)),
    creditBalance: cents(Math.max(0, -net)),
  };
};
