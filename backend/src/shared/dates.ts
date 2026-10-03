/** Data sem horário, formato `YYYY-MM-DD`. */
export type LocalDate = string & { readonly __brand: 'LocalDate' };
/** Mês, formato `YYYY-MM`. */
export type YearMonth = string & { readonly __brand: 'YearMonth' };

const pad = (n: number, size = 2): string => String(n).padStart(size, '0');

export const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

export const daysInMonth = (year: number, month: number): number => {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
};

// ---- YearMonth ----

export const yearMonth = (year: number, month: number): YearMonth => {
  const validYear = Number.isInteger(year) && year >= 1 && year <= 9999;
  const validMonth = Number.isInteger(month) && month >= 1 && month <= 12;
  if (!validYear || !validMonth) throw new RangeError(`Mês inválido: ${year}-${month}`);
  return `${pad(year, 4)}-${pad(month)}` as YearMonth;
};

export const isYearMonth = (value: unknown): value is YearMonth =>
  typeof value === 'string' && /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value);

export const parseYearMonth = (value: string): YearMonth => {
  if (!isYearMonth(value)) throw new RangeError(`YearMonth inválido (esperado YYYY-MM): ${value}`);
  return value;
};

const partsOf = (ym: YearMonth): { year: number; month: number } => ({
  year: Number(ym.slice(0, 4)),
  month: Number(ym.slice(5, 7)),
});

export const compareYearMonths = (a: YearMonth, b: YearMonth): number =>
  a < b ? -1 : a > b ? 1 : 0;

export const addMonths = (ym: YearMonth, months: number): YearMonth => {
  if (!Number.isInteger(months)) throw new RangeError(`Quantidade de meses inválida: ${months}`);
  const { year, month } = partsOf(ym);
  const index = year * 12 + (month - 1) + months;
  return yearMonth(Math.floor(index / 12), (((index % 12) + 12) % 12) + 1);
};

export const lastDayOfMonth = (ym: YearMonth): number => {
  const { year, month } = partsOf(ym);
  return daysInMonth(year, month);
};

// ---- LocalDate ----

export const localDate = (year: number, month: number, day: number): LocalDate => {
  const ym = yearMonth(year, month);
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`Data inválida: ${ym}-${day}`);
  }
  return `${ym}-${pad(day)}` as LocalDate;
};

export const parseLocalDate = (value: string): LocalDate => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError(`LocalDate inválida (esperado YYYY-MM-DD): ${value}`);
  return localDate(Number(match[1]), Number(match[2]), Number(match[3]));
};

export const isLocalDate = (value: unknown): value is LocalDate => {
  if (typeof value !== 'string') return false;
  try {
    return parseLocalDate(value) === value;
  } catch {
    return false;
  }
};

export const compareLocalDates = (a: LocalDate, b: LocalDate): number =>
  a < b ? -1 : a > b ? 1 : 0;

export const yearMonthOf = (date: LocalDate): YearMonth => date.slice(0, 7) as YearMonth;

export const dayOf = (date: LocalDate): number => Number(date.slice(8, 10));

/** Data do dia `day` em `ym`; `day` deve existir no mês (o ajuste de dias é regra de domínio). */
export const dateInMonth = (ym: YearMonth, day: number): LocalDate =>
  localDate(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), day);

/** Soma `days` dias (pode ser negativo) a uma data, tratando meses e anos. */
export const addDays = (date: LocalDate, days: number): LocalDate => {
  const shifted = new Date(
    Date.UTC(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)) - 1,
      Number(date.slice(8, 10)) + days,
    ),
  );
  return localDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
};
