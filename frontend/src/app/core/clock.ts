import { Injectable } from '@angular/core';

/** Relógio injetável: o "hoje" da interface (data local) pode ser substituído nos testes. */
@Injectable({ providedIn: 'root' })
export class Clock {
  /** Data local de hoje, "YYYY-MM-DD". */
  today(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  /** Mês corrente, "YYYY-MM". */
  currentMonth(): string {
    return this.today().slice(0, 7);
  }
}
