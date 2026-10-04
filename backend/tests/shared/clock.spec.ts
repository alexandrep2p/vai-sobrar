import { describe, it, expect } from 'vitest';
import { FixedClock, SystemClock } from '../../src/shared/clock.js';
import { isLocalDate, parseLocalDate } from '../../src/shared/dates.js';

describe('Clock', () => {
  it('FixedClock retorna sempre a data configurada', () => {
    const clock = new FixedClock(parseLocalDate('2028-02-29'));
    expect(clock.today()).toBe('2028-02-29');
    expect(clock.today()).toBe('2028-02-29');
    clock.set(parseLocalDate('2028-03-01'));
    expect(clock.today()).toBe('2028-03-01');
  });

  it('SystemClock retorna uma LocalDate válida', () => {
    expect(isLocalDate(new SystemClock().today())).toBe(true);
  });
});
