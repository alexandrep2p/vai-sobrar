import { describe, it, expect } from 'vitest';
import { invoiceTotals } from '../../src/domain/invoice-totals.js';
import { c } from './helpers.js';

describe('invoiceTotals', () => {
  it('sem créditos', () => {
    expect(
      invoiceTotals({ debits: [c(10000), c(5000)], credits: [], receivedCredits: [] }),
    ).toEqual({
      debits: 15000,
      credits: 0,
      receivedCredit: 0,
      amountDue: 15000,
      creditBalance: 0,
    });
  });

  it('com créditos parciais', () => {
    const totals = invoiceTotals({ debits: [c(50000)], credits: [c(20000)], receivedCredits: [] });
    expect(totals.amountDue).toBe(30000);
    expect(totals.creditBalance).toBe(0);
  });

  it('créditos maiores que débitos (CA-FAT-10)', () => {
    const totals = invoiceTotals({ debits: [c(10000)], credits: [c(15000)], receivedCredits: [] });
    expect(totals.amountDue).toBe(0);
    expect(totals.creditBalance).toBe(5000);
  });

  it('com crédito recebido', () => {
    const totals = invoiceTotals({ debits: [c(30000)], credits: [], receivedCredits: [c(5000)] });
    expect(totals.amountDue).toBe(25000);
    expect(totals.creditBalance).toBe(0);
  });

  it('cascata: crédito recebido também supera os débitos', () => {
    const totals = invoiceTotals({ debits: [c(2000)], credits: [], receivedCredits: [c(5000)] });
    expect(totals.amountDue).toBe(0);
    expect(totals.creditBalance).toBe(3000);
  });

  it('fatura vazia e valor a pagar nunca negativo', () => {
    const empty = invoiceTotals({ debits: [], credits: [], receivedCredits: [] });
    expect(empty.amountDue).toBe(0);
    expect(empty.creditBalance).toBe(0);
    const over = invoiceTotals({ debits: [], credits: [c(1)], receivedCredits: [c(1)] });
    expect(over.amountDue).toBe(0);
    expect(over.creditBalance).toBe(2);
  });
});
