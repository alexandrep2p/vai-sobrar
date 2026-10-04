import { describe, it, expect } from 'vitest';
import { recognitionInvoice, validateRefundDate } from '../../src/domain/refund-recognition.js';
import { BusinessError } from '../../src/shared/errors.js';
import { d, invoice, closed } from './helpers.js';

const card = { bestPurchaseDay: 6, dueDay: 15 };
const open = invoice('2027-10', '2027-10-06', '2027-10-15', 'OPEN');
const closedInv = invoice('2027-10', '2027-10-06', '2027-10-15', 'CLOSED');
const paid = invoice('2027-10', '2027-10-06', '2027-10-15', 'PAID');

describe('recognitionInvoice', () => {
  it('alvo em fatura OPEN com mês aberto → a própria fatura', () => {
    const result = recognitionInvoice(
      card,
      open,
      d('2027-10-03'),
      [open],
      closed(),
      d('2027-10-03'),
    );
    expect(result).toEqual({ needsCreation: false, invoice: open });
  });

  it('parcela futura em fatura OPEN é reconhecida na fatura da parcela', () => {
    const future = invoice('2028-01', '2028-01-06', '2028-01-15', 'OPEN');
    const result = recognitionInvoice(
      card,
      future,
      d('2027-10-03'),
      [future],
      closed(),
      d('2027-10-03'),
    );
    expect(result).toEqual({ needsCreation: false, invoice: future });
  });

  it('alvo em fatura CLOSED → fatura do ciclo do estorno, criada se preciso (CA-EST-15)', () => {
    const result = recognitionInvoice(
      card,
      closedInv,
      d('2027-10-20'),
      [closedInv],
      closed(),
      d('2027-10-20'),
    );
    expect(result.needsCreation).toBe(true);
    expect(result.invoice).toMatchObject({ referenceMonth: '2027-11', status: 'OPEN' });
  });

  it('alvo em fatura PAID ou de mês fechado → fatura do estorno', () => {
    const viaPaid = recognitionInvoice(
      card,
      paid,
      d('2027-10-20'),
      [paid],
      closed(),
      d('2027-10-20'),
    );
    expect(viaPaid.invoice.referenceMonth).toBe('2027-11');
    const viaClosedMonth = recognitionInvoice(
      card,
      open,
      d('2027-10-20'),
      [open],
      closed('2027-10'),
      d('2027-10-20'),
    );
    expect(viaClosedMonth.invoice.referenceMonth).toBe('2027-11');
  });

  it('estorno tardio em junho de compra de abril fechado (CA-EST-11)', () => {
    const april = invoice('2027-04', '2027-04-06', '2027-04-15', 'PAID');
    const result = recognitionInvoice(
      card,
      april,
      d('2027-06-03'),
      [april],
      closed('2027-04'),
      d('2027-06-03'),
    );
    expect(result.needsCreation).toBe(true);
    expect(result.invoice.referenceMonth).toBe('2027-06');
  });

  it('fatura do estorno também não elegível → próxima aberta', () => {
    const nov = invoice('2027-11', '2027-11-06', '2027-11-15', 'CLOSED');
    const dec = invoice('2027-12', '2027-12-06', '2027-12-15', 'OPEN');
    const result = recognitionInvoice(
      card,
      paid,
      d('2027-11-03'),
      [paid, nov, dec],
      closed(),
      d('2027-11-20'),
    );
    expect(result).toEqual({ needsCreation: false, invoice: dec });
  });

  it('ciclo passado sem fatura persistida é pulado, sem criar fatura vazia', () => {
    // refund_date 05/10, hoje 20/11: ciclo de outubro (fechou 06/10) e novembro (fechou 06/11) já passaram
    const result = recognitionInvoice(
      card,
      paid,
      d('2027-10-05'),
      [paid],
      closed(),
      d('2027-11-20'),
    );
    expect(result.needsCreation).toBe(true);
    expect(result.invoice).toMatchObject({
      referenceMonth: '2027-12',
      status: 'OPEN',
      closingDate: '2027-12-06',
    });
  });

  it('ciclo sem fatura com fechamento hoje ainda recebe crédito', () => {
    const result = recognitionInvoice(
      card,
      paid,
      d('2027-11-03'),
      [paid],
      closed(),
      d('2027-11-06'),
    );
    expect(result.invoice.referenceMonth).toBe('2027-11');
  });

  it('ciclo de mês fechado sem fatura é pulado', () => {
    const result = recognitionInvoice(
      card,
      paid,
      d('2027-11-03'),
      [paid],
      closed('2027-11'),
      d('2027-11-03'),
    );
    expect(result.invoice.referenceMonth).toBe('2027-12');
  });
});

describe('validateRefundDate (CA-EST-14)', () => {
  const purchase = d('2027-10-05');
  const today = d('2027-10-20');

  it('aceita entre a compra e hoje, inclusive os extremos', () => {
    expect(() => validateRefundDate(purchase, d('2027-10-05'), today)).not.toThrow();
    expect(() => validateRefundDate(purchase, d('2027-10-20'), today)).not.toThrow();
  });

  it('rejeita anterior à compra e futura', () => {
    for (const bad of ['2027-10-04', '2027-10-21']) {
      try {
        validateRefundDate(purchase, d(bad), today);
        expect.unreachable();
      } catch (error) {
        expect((error as BusinessError).code).toBe('INVALID_REFUND_DATE');
      }
    }
  });
});
