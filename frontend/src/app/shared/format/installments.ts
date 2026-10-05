import { formatCents } from './money';

/**
 * Descreve a distribuição das parcelas (installments.md §6): piso para todas e os centavos
 * restantes, um a um, nas últimas. Só para exibição; quem grava as parcelas é o backend.
 * Ex.: 10000 em 3x -> "2x de R$ 33,33 e 1x de R$ 33,34".
 */
export function describeInstallments(total: number, count: number): string {
  const base = Math.floor(total / count);
  const rest = total - base * count;
  if (rest === 0) return `${count}x de ${formatCents(base)}`;
  return `${count - rest}x de ${formatCents(base)} e ${rest}x de ${formatCents(base + 1)}`;
}
