import { describe, it, expect } from 'vitest';
import { cycleOf, postingInvoice } from '../../src/domain/posting.js';
import { d, invoice, closed } from './helpers.js';

const card = { bestPurchaseDay: 6, dueDay: 15 };
const none = closed();

describe('cycleOf (CA-CAR-02)', () => {
  it('antes, no e depois do melhor dia', () => {
    expect(cycleOf(card, d('2027-10-05'), [])).toBe('2027-10');
    expect(cycleOf(card, d('2027-10-06'), [])).toBe('2027-10');
    expect(cycleOf(card, d('2027-10-07'), [])).toBe('2027-11');
  });

  it('virada de ano', () => {
    expect(cycleOf(card, d('2027-12-07'), [])).toBe('2028-01');
  });

  it('usa o closing_date gravado, não a configuração atual (CA-CAR-11)', () => {
    const changed = { bestPurchaseDay: 10, dueDay: 15 };
    const persisted = [invoice('2027-10', '2027-10-06', '2027-10-15', 'OPEN')];
    expect(cycleOf(changed, d('2027-10-08'), persisted)).toBe('2027-11');
    expect(cycleOf(changed, d('2027-10-08'), [])).toBe('2027-10');
  });
});

describe('postingInvoice', () => {
  it('fatura inexistente com fechamento futuro → criada OPEN', () => {
    const result = postingInvoice(card, d('2027-10-05'), [], none, d('2027-10-01'));
    expect(result).toEqual({
      needsCreation: true,
      invoice: {
        referenceMonth: '2027-10',
        closingDate: '2027-10-06',
        dueDate: '2027-10-15',
        status: 'OPEN',
      },
    });
  });

  it('fechamento no dia de hoje ainda é OPEN; no passado é CLOSED', () => {
    const today = postingInvoice(card, d('2027-10-05'), [], none, d('2027-10-06'));
    expect(today.invoice.status).toBe('OPEN');
    const past = postingInvoice(card, d('2027-10-05'), [], none, d('2027-10-20'));
    expect(past.needsCreation).toBe(true);
    expect(past.invoice.status).toBe('CLOSED');
  });

  it('fatura do ciclo CLOSED e não paga aceita a compra (CA-CAR-08)', () => {
    const existing = invoice('2027-10', '2027-10-06', '2027-10-15', 'CLOSED');
    const result = postingInvoice(card, d('2027-10-05'), [existing], none, d('2027-10-20'));
    expect(result).toEqual({ needsCreation: false, invoice: existing });
  });

  it('fatura do ciclo PAID → próxima, preservando a fatura paga (CA-CAR-09)', () => {
    const paid = invoice('2027-10', '2027-10-06', '2027-10-15', 'PAID');
    const result = postingInvoice(card, d('2027-10-05'), [paid], none, d('2027-10-20'));
    expect(result.needsCreation).toBe(true);
    expect(result.invoice).toMatchObject({
      referenceMonth: '2027-11',
      closingDate: '2027-11-06',
      dueDate: '2027-11-15',
      status: 'OPEN',
    });
  });

  it('mês do ciclo fechado → próxima fatura', () => {
    const existing = invoice('2027-10', '2027-10-06', '2027-10-15', 'CLOSED');
    const result = postingInvoice(
      card,
      d('2027-10-05'),
      [existing],
      closed('2027-10'),
      d('2027-10-20'),
    );
    expect(result.invoice.referenceMonth).toBe('2027-11');
  });

  it('mês fechado sem fatura persistida também é pulado', () => {
    const result = postingInvoice(card, d('2027-10-05'), [], closed('2027-10'), d('2027-10-20'));
    expect(result.invoice.referenceMonth).toBe('2027-11');
  });

  it('várias faturas seguidas pagas, com virada de ano', () => {
    const invoices = [
      invoice('2027-11', '2027-11-06', '2027-11-15', 'PAID'),
      invoice('2027-12', '2027-12-06', '2027-12-15', 'PAID'),
    ];
    const result = postingInvoice(card, d('2027-11-02'), invoices, none, d('2027-12-20'));
    expect(result.invoice.referenceMonth).toBe('2028-01');
    expect(result.invoice.status).toBe('OPEN');
  });

  it('pula PAID e mês fechado combinados e aceita fatura existente posterior', () => {
    const invoices = [
      invoice('2027-10', '2027-10-06', '2027-10-15', 'PAID'),
      invoice('2027-12', '2027-12-06', '2027-12-15', 'OPEN'),
    ];
    const result = postingInvoice(
      card,
      d('2027-10-05'),
      invoices,
      closed('2027-11'),
      d('2027-10-20'),
    );
    expect(result).toEqual({ needsCreation: false, invoice: invoices[1] });
  });

  it('mudança de melhor dia com fatura persistida (credit-cards §12)', () => {
    const changed = { bestPurchaseDay: 10, dueDay: 15 };
    const persisted = [invoice('2027-10', '2027-10-06', '2027-10-15', 'OPEN')];
    const result = postingInvoice(changed, d('2027-10-08'), persisted, none, d('2027-10-03'));
    expect(result.needsCreation).toBe(true);
    expect(result.invoice).toMatchObject({
      referenceMonth: '2027-11',
      closingDate: '2027-11-10',
      dueDate: '2027-11-15',
    });
  });

  it('melhor dia 25, vencimento 5: compra de 20/10 fica em outubro, vence 05/11', () => {
    const c25 = { bestPurchaseDay: 25, dueDay: 5 };
    const result = postingInvoice(c25, d('2027-10-20'), [], none, d('2027-10-20'));
    expect(result.invoice).toMatchObject({
      referenceMonth: '2027-10',
      dueDate: '2027-11-05',
    });
  });
});
