import { describe, it, expect } from 'vitest';
import { splitCents, splitCentsProportional } from '../../src/domain/split-cents.js';
import { c } from './helpers.js';

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

describe('splitCents', () => {
  it('divisão exata (CA-PAR-01)', () => {
    expect(splitCents(c(30000), 3)).toEqual([10000, 10000, 10000]);
  });

  it('resto vai para as últimas posições (CA-PAR-02, CA-PAR-03)', () => {
    expect(splitCents(c(10000), 3)).toEqual([3333, 3333, 3334]);
    expect(splitCents(c(1000), 6)).toEqual([166, 166, 167, 167, 167, 167]);
  });

  it('n = 2 e n grande', () => {
    expect(splitCents(c(101), 2)).toEqual([50, 51]);
    const parts = splitCents(c(100001), 120);
    expect(parts).toHaveLength(120);
    expect(sum(parts)).toBe(100001);
    expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
  });

  it('soma sempre igual ao total', () => {
    for (let total = 0; total < 300; total += 7) {
      for (let n = 1; n <= 13; n += 1) {
        expect(sum(splitCents(c(total), n))).toBe(total);
      }
    }
  });

  it('rejeita n inválido', () => {
    expect(() => splitCents(c(100), 0)).toThrow(RangeError);
    expect(() => splitCents(c(100), 1.5)).toThrow(RangeError);
  });
});

describe('splitCentsProportional', () => {
  it('pesos iguais equivalem a splitCents', () => {
    expect(splitCentsProportional(c(9000), [c(10000), c(10000), c(10000)])).toEqual([
      3000, 3000, 3000,
    ]);
  });

  it('pesos desiguais 33,33 / 33,33 / 34,34 (CA-EST-10)', () => {
    const weights = [c(3333), c(3333), c(3334)];
    expect(splitCentsProportional(c(10000), weights)).toEqual([3333, 3333, 3334]);
    const partial = splitCentsProportional(c(5000), weights);
    expect(sum(partial)).toBe(5000);
  });

  it('centavos restantes vão para os últimos participantes', () => {
    expect(splitCentsProportional(c(100), [c(1), c(1), c(1)])).toEqual([33, 33, 34]);
    expect(splitCentsProportional(c(101), [c(1), c(1), c(1)])).toEqual([33, 34, 34]);
  });

  it('não participantes (peso 0) recebem 0 e não recebem centavos extras', () => {
    expect(splitCentsProportional(c(100), [c(1), c(0), c(1), c(1), c(0)])).toEqual([
      33, 0, 33, 34, 0,
    ]);
  });

  it('nunca ultrapassa o peso e sempre soma o total', () => {
    const weights = [c(333), c(333), c(334), c(1), c(999)];
    const weightSum = sum(weights);
    for (let total = 0; total <= weightSum; total += 13) {
      const parts = splitCentsProportional(c(total), weights);
      expect(sum(parts)).toBe(total);
      parts.forEach((p, i) => expect(p).toBeLessThanOrEqual(weights[i] ?? 0));
    }
  });

  it('soma de pesos zero só aceita total zero', () => {
    expect(splitCentsProportional(c(0), [c(0), c(0)])).toEqual([0, 0]);
    expect(() => splitCentsProportional(c(1), [c(0)])).toThrow(RangeError);
  });
});
