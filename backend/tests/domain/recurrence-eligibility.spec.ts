import { describe, it, expect } from 'vitest';
import {
  occurrenceDate,
  occurrenceEligibility,
  type OccurrenceState,
  type RecurrenceRule,
} from '../../src/domain/recurrence-eligibility.js';
import { d, m, closed } from './helpers.js';

const rule = (overrides: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  dueDay: 10,
  startDate: d('2027-01-01'),
  createdOn: d('2027-01-01'),
  status: 'ACTIVE',
  ...overrides,
});

const state = (overrides: Partial<OccurrenceState> = {}): OccurrenceState => ({
  hasException: false,
  paymentMethodActive: true,
  categoryActive: true,
  paidWithCard: false,
  closedMonths: closed(),
  ...overrides,
});

const reasonOf = (r: RecurrenceRule, month: string, s: OccurrenceState = state()) => {
  const result = occurrenceEligibility(r, m(month), s);
  return result.eligible ? 'ELIGIBLE' : result.reason;
};

describe('occurrenceDate (CA-REC-03)', () => {
  it('ajusta o dia para meses curtos e bissexto', () => {
    expect(occurrenceDate(31, m('2027-02'))).toBe('2027-02-28');
    expect(occurrenceDate(31, m('2028-02'))).toBe('2028-02-29');
    expect(occurrenceDate(31, m('2027-04'))).toBe('2027-04-30');
    expect(occurrenceDate(10, m('2027-02'))).toBe('2027-02-10');
  });
});

describe('occurrenceEligibility', () => {
  it('elegível: retorna a data (sem purchaseDate para método comum)', () => {
    expect(occurrenceEligibility(rule(), m('2027-03'), state())).toEqual({
      eligible: true,
      date: '2027-03-10',
    });
  });

  it('cartão: a data é a purchase_date', () => {
    expect(occurrenceEligibility(rule(), m('2027-03'), state({ paidWithCard: true }))).toEqual({
      eligible: true,
      date: '2027-03-10',
      purchaseDate: '2027-03-10',
    });
  });

  it('criada no meio do mês: sem ocorrência no mês da criação (CA-REC-02)', () => {
    const r = rule({ startDate: d('2027-09-20'), createdOn: d('2027-09-20') });
    expect(reasonOf(r, '2027-09')).toBe('BEFORE_START_OR_CREATION');
    expect(reasonOf(r, '2027-10')).toBe('ELIGIBLE');
  });

  it('respeita start_date posterior à criação e ocorrência no próprio dia da criação', () => {
    expect(reasonOf(rule({ startDate: d('2027-03-11') }), '2027-03')).toBe(
      'BEFORE_START_OR_CREATION',
    );
    expect(
      reasonOf(rule({ startDate: d('2027-03-10'), createdOn: d('2027-03-10') }), '2027-03'),
    ).toBe('ELIGIBLE');
  });

  it('dia 31 em fevereiro/2028 cai em 29/02 e respeita end_date', () => {
    const r = rule({ dueDay: 31, endDate: d('2028-02-29') });
    const result = occurrenceEligibility(r, m('2028-02'), state());
    expect(result).toEqual({ eligible: true, date: '2028-02-29' });
    expect(reasonOf(r, '2028-03')).toBe('AFTER_END_DATE');
  });

  it('end_date anterior à data ajustada bloqueia', () => {
    expect(reasonOf(rule({ dueDay: 31, endDate: d('2027-02-27') }), '2027-02')).toBe(
      'AFTER_END_DATE',
    );
  });

  it('cancelada: nada a partir do cancelamento, histórico anterior preservado', () => {
    const r = rule({ status: 'CANCELLED', cancelledOn: d('2027-05-10') });
    expect(reasonOf(r, '2027-04')).toBe('ELIGIBLE');
    expect(reasonOf(r, '2027-05')).toBe('CANCELLED');
    expect(reasonOf(r, '2027-06')).toBe('CANCELLED');
    expect(reasonOf(rule({ status: 'CANCELLED' }), '2027-06')).toBe('CANCELLED');
  });

  it('pausa com retorno programado (CA-REC-11)', () => {
    const r = rule({
      status: 'PAUSED',
      pausedFrom: d('2027-01-01'),
      pausedUntil: d('2027-04-01'),
      startDate: d('2026-01-01'),
      createdOn: d('2026-01-01'),
    });
    expect(reasonOf(r, '2026-12')).toBe('ELIGIBLE');
    expect(reasonOf(r, '2027-01')).toBe('PAUSED');
    expect(reasonOf(r, '2027-02')).toBe('PAUSED');
    expect(reasonOf(r, '2027-03')).toBe('PAUSED');
    expect(reasonOf(r, '2027-04')).toBe('ELIGIBLE');
  });

  it('pausa sem retorno bloqueia todos os meses seguintes', () => {
    const r = rule({ status: 'PAUSED', pausedFrom: d('2027-03-01') });
    expect(reasonOf(r, '2027-02')).toBe('ELIGIBLE');
    expect(reasonOf(r, '2027-03')).toBe('PAUSED');
    expect(reasonOf(r, '2030-12')).toBe('PAUSED');
  });

  it('pausa que começa depois da data da ocorrência do mês não a bloqueia', () => {
    expect(reasonOf(rule({ pausedFrom: d('2027-03-11') }), '2027-03')).toBe('ELIGIBLE');
  });

  it('com exceção (ocorrência pulada)', () => {
    expect(reasonOf(rule(), '2027-03', state({ hasException: true }))).toBe('SKIPPED');
  });

  it('método ou categoria inativos bloqueiam; reativados voltam (CA-REC-13)', () => {
    expect(reasonOf(rule(), '2027-03', state({ paymentMethodActive: false }))).toBe(
      'PAYMENT_METHOD_INACTIVE',
    );
    expect(reasonOf(rule(), '2027-03', state({ categoryActive: false }))).toBe('CATEGORY_INACTIVE');
    expect(reasonOf(rule(), '2027-05', state())).toBe('ELIGIBLE');
  });

  it('mês fechado bloqueia método comum, mas não cartão (regra de compra tardia)', () => {
    const closedMonths = closed('2027-03');
    expect(reasonOf(rule(), '2027-03', state({ closedMonths }))).toBe('PERIOD_CLOSED');
    expect(reasonOf(rule(), '2027-03', state({ closedMonths, paidWithCard: true }))).toBe(
      'ELIGIBLE',
    );
  });
});
