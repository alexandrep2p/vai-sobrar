import { describe, it, expect } from 'vitest';
import { closingDate, dueDate, effectiveDay } from '../../src/domain/card-dates.js';
import {
  compareLocalDates,
  dateInMonth,
  lastDayOfMonth,
  addMonths,
} from '../../src/shared/dates.js';
import { d, m, invoice } from './helpers.js';

describe('effectiveDay (CA-CAR-06)', () => {
  it('ajusta dias inexistentes para o último dia do mês', () => {
    expect(effectiveDay(31, m('2027-02'))).toBe(28);
    expect(effectiveDay(31, m('2028-02'))).toBe(29);
    expect(effectiveDay(30, m('2028-02'))).toBe(29);
    expect(effectiveDay(29, m('2027-02'))).toBe(28);
    expect(effectiveDay(29, m('2028-02'))).toBe(29);
    expect(effectiveDay(30, m('2027-04'))).toBe(30);
    expect(effectiveDay(31, m('2027-04'))).toBe(30);
    expect(effectiveDay(31, m('2027-10'))).toBe(31);
    expect(effectiveDay(6, m('2027-02'))).toBe(6);
  });

  it('rejeita dia fora de 1..31', () => {
    expect(() => effectiveDay(0, m('2027-01'))).toThrow(RangeError);
    expect(() => effectiveDay(32, m('2027-01'))).toThrow(RangeError);
  });
});

describe('closingDate', () => {
  it('calcula com a configuração vigente', () => {
    expect(closingDate({ bestPurchaseDay: 6, dueDay: 15 }, m('2027-10'))).toBe('2027-10-06');
    expect(closingDate({ bestPurchaseDay: 31, dueDay: 30 }, m('2027-02'))).toBe('2027-02-28');
    expect(closingDate({ bestPurchaseDay: 31, dueDay: 30 }, m('2028-02'))).toBe('2028-02-29');
  });

  it('usa o closing_date gravado quando a fatura existe (CA-CAR-10)', () => {
    const persisted = invoice('2027-10', '2027-10-06', '2027-10-15', 'OPEN');
    expect(closingDate({ bestPurchaseDay: 10, dueDay: 15 }, m('2027-10'), persisted)).toBe(
      '2027-10-06',
    );
  });
});

describe('dueDate (credit-cards §6.4)', () => {
  it('melhor dia 6, vencimento 15 → 15/10 (CA-CAR-03)', () => {
    const card = { bestPurchaseDay: 6, dueDay: 15 };
    expect(dueDate(card, d('2027-10-06'))).toBe('2027-10-15');
  });

  it('melhor dia 25, vencimento 5 → 05/11 e 05/12 (CA-CAR-04, CA-CAR-05)', () => {
    const card = { bestPurchaseDay: 25, dueDay: 5 };
    expect(dueDate(card, d('2027-10-25'))).toBe('2027-11-05');
    expect(dueDate(card, d('2027-11-25'))).toBe('2027-12-05');
  });

  it('melhor dia 10, vencimento 10 → 10/11', () => {
    expect(dueDate({ bestPurchaseDay: 10, dueDay: 10 }, d('2027-10-10'))).toBe('2027-11-10');
  });

  it('melhor dia 31, vencimento 30, fevereiro/2027 → 30/03/2027', () => {
    const card = { bestPurchaseDay: 31, dueDay: 30 };
    expect(dueDate(card, d('2027-02-28'))).toBe('2027-03-30');
  });

  it('fevereiro bissexto e virada de ano', () => {
    expect(dueDate({ bestPurchaseDay: 28, dueDay: 31 }, d('2028-02-28'))).toBe('2028-02-29');
    expect(dueDate({ bestPurchaseDay: 25, dueDay: 5 }, d('2027-12-25'))).toBe('2028-01-05');
  });

  it('o vencimento é sempre posterior ao fechamento (CA-CAR-07)', () => {
    for (const best of [1, 5, 10, 15, 28, 29, 30, 31]) {
      for (const due of [1, 5, 10, 15, 28, 29, 30, 31]) {
        for (let i = 0; i < 24; i += 1) {
          const month = addMonths(m('2027-01'), i);
          const card = { bestPurchaseDay: best, dueDay: due };
          const closing = closingDate(card, month);
          expect(dateInMonth(month, Math.min(best, lastDayOfMonth(month)))).toBe(closing);
          expect(compareLocalDates(dueDate(card, closing), closing)).toBe(1);
        }
      }
    }
  });
});
