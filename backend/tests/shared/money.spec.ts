import { describe, it, expect } from 'vitest';
import {
  cents,
  isCents,
  addCents,
  subtractCents,
  centsFromDecimalString,
  centsToDecimalString,
} from '../../src/shared/money.js';

describe('money', () => {
  it('aceita inteiros e rejeita não inteiros', () => {
    expect(cents(1234)).toBe(1234);
    expect(cents(-50)).toBe(-50);
    expect(() => cents(12.5)).toThrow(RangeError);
    expect(() => cents(NaN)).toThrow(RangeError);
    expect(() => cents(Infinity)).toThrow(RangeError);
    expect(() => cents(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
    expect(isCents('10')).toBe(false);
  });

  it('soma e subtrai inteiros', () => {
    expect(addCents(cents(10), cents(20))).toBe(30);
    expect(subtractCents(cents(10), cents(20))).toBe(-10);
  });

  it('converte texto decimal sem erro de ponto flutuante', () => {
    expect(centsFromDecimalString('12.34')).toBe(1234);
    expect(centsFromDecimalString('0.1')).toBe(10);
    expect(centsFromDecimalString('19.99')).toBe(1999);
    expect(centsFromDecimalString('1.15')).toBe(115);
    expect(centsFromDecimalString('7')).toBe(700);
    expect(centsFromDecimalString('-0.5')).toBe(-50);
  });

  it('rejeita texto decimal inválido ou com mais de 2 casas', () => {
    for (const bad of ['', 'abc', '1.234', '1,5', '1.', '.5', '--1']) {
      expect(() => centsFromDecimalString(bad)).toThrow(RangeError);
    }
  });

  it('formata centavos como texto decimal', () => {
    expect(centsToDecimalString(cents(1234))).toBe('12.34');
    expect(centsToDecimalString(cents(5))).toBe('0.05');
    expect(centsToDecimalString(cents(-50))).toBe('-0.50');
    expect(centsToDecimalString(cents(0))).toBe('0.00');
  });
});
