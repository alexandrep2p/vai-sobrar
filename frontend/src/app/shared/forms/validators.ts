import { AbstractControl, ValidationErrors } from '@angular/forms';
import { parseCents } from '../format/money';

/** Valor monetário digitado: obrigatório, válido e maior que zero. */
export function positiveMoney(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  if (!value) return { required: true };
  const cents = parseCents(value);
  if (cents === null) return { money: true };
  return cents > 0 ? null : { positive: true };
}

/** Valor monetário que aceita zero (ex.: pagamento de fatura). */
export function nonNegativeMoney(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  if (!value) return { required: true };
  return parseCents(value) === null ? { money: true } : null;
}

/** Texto obrigatório após trim, com limite de caracteres. */
export function trimmedLength(max: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const length = String(control.value ?? '').trim().length;
    if (length === 0) return { required: true };
    return length > max ? { maxlength: { requiredLength: max } } : null;
  };
}
