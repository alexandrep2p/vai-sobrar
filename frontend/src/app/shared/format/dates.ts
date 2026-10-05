const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH = /^(\d{4})-(\d{2})$/;

/** Formata uma data local da API ("2026-03-05") como "05/03/2026", sem passar por fuso horário. */
export function formatDate(date: string): string {
  const match = LOCAL_DATE.exec(date);
  if (!match) throw new RangeError(`Data inválida: ${date}`);
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** Formata um mês da API ("2026-03") como "março de 2026". */
export function formatMonth(month: string): string {
  const match = MONTH.exec(month);
  const index = match ? Number(match[2]) - 1 : -1;
  if (!match || index < 0 || index > 11) throw new RangeError(`Mês inválido: ${month}`);
  return `${MONTHS[index]} de ${match[1]}`;
}

/** Soma (ou subtrai) meses de um mês "YYYY-MM". */
export function addMonths(month: string, delta: number): string {
  const match = MONTH.exec(month);
  if (!match) throw new RangeError(`Mês inválido: ${month}`);
  const total = Number(match[1]) * 12 + (Number(match[2]) - 1) + delta;
  const year = Math.floor(total / 12);
  return `${year}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/**
 * Próxima data de uma recorrência com `dueDay` em ou depois de `from` (ajusta meses curtos).
 * Só para exibir dicas; a regra de elegibilidade das ocorrências é a do backend.
 */
export function nextOccurrenceDate(dueDay: number, from: string): string {
  const month = monthOf(from);
  const candidate = dateInMonth(dueDay, month);
  return candidate >= from ? candidate : dateInMonth(dueDay, addMonths(month, 1));
}

function dateInMonth(day: number, month: string): string {
  const [year, mon] = month.split('-').map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return `${month}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

/** Formata "2027-01-05" como "05/01" (data curta do extrato). */
export function formatShortDate(date: string): string {
  return formatDate(date).slice(0, 5);
}

/** Mês de uma data local ("2027-01-05" -> "2027-01"). */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Mês curto para títulos e confirmações ("2027-01" -> "janeiro/2027"). */
export function formatMonthShort(month: string): string {
  return formatMonth(month).replace(' de ', '/');
}
