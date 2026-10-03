import { localDate, type LocalDate } from './dates.js';

/** Fonte de "hoje" injetável, para testes determinísticos. */
export interface Clock {
  today(): LocalDate;
}

/** Relógio real: data civil no fuso do servidor. */
export class SystemClock implements Clock {
  today(): LocalDate {
    const now = new Date();
    return localDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }
}

/** Relógio fixo, para testes. */
export class FixedClock implements Clock {
  constructor(private current: LocalDate) {}

  today(): LocalDate {
    return this.current;
  }

  set(date: LocalDate): void {
    this.current = date;
  }
}
