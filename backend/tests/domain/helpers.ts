import { parseLocalDate, parseYearMonth } from '../../src/shared/dates.js';
import { cents } from '../../src/shared/money.js';
import type { InvoiceSnapshot, InvoiceStatus } from '../../src/domain/types.js';

export const d = parseLocalDate;
export const m = parseYearMonth;
export const c = cents;

export const closed = (...months: string[]): ReadonlySet<ReturnType<typeof m>> =>
  new Set(months.map(m));

export const invoice = (
  referenceMonth: string,
  closingDate: string,
  dueDate: string,
  status: InvoiceStatus,
): InvoiceSnapshot => ({
  referenceMonth: m(referenceMonth),
  closingDate: d(closingDate),
  dueDate: d(dueDate),
  status,
});
