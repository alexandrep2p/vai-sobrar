import { formatDate, formatMonth, nextOccurrenceDate } from './dates';
import { formatCents, formatMoneyInput } from './money';

const nbsp = (s: string) => s.replace(/\s/g, ' ');

describe('formatCents', () => {
  it('formata centavos como reais', () => {
    expect(nbsp(formatCents(123456))).toBe('R$ 1.234,56');
    expect(nbsp(formatCents(5))).toBe('R$ 0,05');
    expect(nbsp(formatCents(0))).toBe('R$ 0,00');
    expect(nbsp(formatCents(100))).toBe('R$ 1,00');
  });

  it('formata valores negativos', () => {
    expect(nbsp(formatCents(-1050))).toBe('-R$ 10,50');
  });

  it('rejeita valores que não são inteiros', () => {
    expect(() => formatCents(10.5)).toThrow(RangeError);
    expect(() => formatCents(Number.NaN)).toThrow(RangeError);
  });
});

describe('formatDate', () => {
  it('formata data local sem deslocamento de fuso', () => {
    expect(formatDate('2026-03-05')).toBe('05/03/2026');
    expect(formatDate('2026-12-31')).toBe('31/12/2026');
  });

  it('rejeita formato inválido', () => {
    expect(() => formatDate('05/03/2026')).toThrow(RangeError);
  });
});

describe('formatMonth', () => {
  it('formata o mês por extenso', () => {
    expect(formatMonth('2026-03')).toBe('março de 2026');
    expect(formatMonth('2026-12')).toBe('dezembro de 2026');
  });

  it('rejeita mês inválido', () => {
    expect(() => formatMonth('2026-13')).toThrow(RangeError);
    expect(() => formatMonth('2026-3')).toThrow(RangeError);
  });
});

describe('nextOccurrenceDate', () => {
  it('usa o dia no mês corrente quando ainda não passou (inclusive hoje)', () => {
    expect(nextOccurrenceDate(10, '2027-01-10')).toBe('2027-01-10');
    expect(nextOccurrenceDate(20, '2027-01-10')).toBe('2027-01-20');
  });

  it('passa para o mês seguinte quando o dia já passou', () => {
    expect(nextOccurrenceDate(5, '2027-01-10')).toBe('2027-02-05');
    expect(nextOccurrenceDate(5, '2027-12-10')).toBe('2028-01-05');
  });

  it('ajusta meses curtos ao último dia', () => {
    expect(nextOccurrenceDate(31, '2027-02-10')).toBe('2027-02-28');
    expect(nextOccurrenceDate(31, '2028-02-10')).toBe('2028-02-29');
    expect(nextOccurrenceDate(30, '2027-01-31')).toBe('2027-02-28');
  });
});

describe('formatMoneyInput', () => {
  it('formata centavos com separador de milhar e vírgula', () => {
    expect(formatMoneyInput(0)).toBe('0,00');
    expect(formatMoneyInput(5)).toBe('0,05');
    expect(formatMoneyInput(123456)).toBe('1.234,56');
    expect(formatMoneyInput(123456789)).toBe('1.234.567,89');
  });
});
