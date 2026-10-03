import { describe, it, expect } from 'vitest';
import {
  addMonths,
  compareLocalDates,
  compareYearMonths,
  dayOf,
  isLocalDate,
  isYearMonth,
  lastDayOfMonth,
  localDate,
  parseLocalDate,
  parseYearMonth,
  yearMonthOf,
} from '../../src/shared/dates.js';

const ym = parseYearMonth;

describe('YearMonth', () => {
  it('valida o formato', () => {
    expect(isYearMonth('2027-02')).toBe(true);
    expect(isYearMonth('2027-13')).toBe(false);
    expect(isYearMonth('2027-2')).toBe(false);
    expect(() => parseYearMonth('abc')).toThrow(RangeError);
  });

  it('calcula o último dia do mês, incluindo bissexto', () => {
    expect(lastDayOfMonth(ym('2027-02'))).toBe(28);
    expect(lastDayOfMonth(ym('2028-02'))).toBe(29);
    expect(lastDayOfMonth(ym('1900-02'))).toBe(28);
    expect(lastDayOfMonth(ym('2000-02'))).toBe(29);
    expect(lastDayOfMonth(ym('2027-04'))).toBe(30);
    expect(lastDayOfMonth(ym('2027-12'))).toBe(31);
  });

  it('soma meses com virada de ano', () => {
    expect(addMonths(ym('2027-12'), 1)).toBe('2028-01');
    expect(addMonths(ym('2028-01'), -1)).toBe('2027-12');
    expect(addMonths(ym('2027-11'), 14)).toBe('2029-01');
    expect(addMonths(ym('2027-03'), -15)).toBe('2025-12');
    expect(addMonths(ym('2027-05'), 0)).toBe('2027-05');
  });

  it('compara meses', () => {
    expect(compareYearMonths(ym('2027-12'), ym('2028-01'))).toBe(-1);
    expect(compareYearMonths(ym('2028-01'), ym('2027-12'))).toBe(1);
    expect(compareYearMonths(ym('2027-05'), ym('2027-05'))).toBe(0);
  });
});

describe('LocalDate', () => {
  it('valida datas reais', () => {
    expect(parseLocalDate('2028-02-29')).toBe('2028-02-29');
    expect(() => parseLocalDate('2027-02-29')).toThrow(RangeError);
    expect(() => parseLocalDate('2027-04-31')).toThrow(RangeError);
    expect(() => parseLocalDate('2027-1-01')).toThrow(RangeError);
    expect(isLocalDate('2027-02-28')).toBe(true);
    expect(isLocalDate('2027-02-30')).toBe(false);
    expect(isLocalDate(20270228)).toBe(false);
  });

  it('constrói, compara e extrai partes', () => {
    const a = localDate(2027, 12, 31);
    const b = localDate(2028, 1, 1);
    expect(a).toBe('2027-12-31');
    expect(compareLocalDates(a, b)).toBe(-1);
    expect(compareLocalDates(b, a)).toBe(1);
    expect(compareLocalDates(a, a)).toBe(0);
    expect(yearMonthOf(a)).toBe('2027-12');
    expect(dayOf(a)).toBe(31);
  });
});
