import { formatDate, formatMonth } from './dates';
import { formatCents } from './money';

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
