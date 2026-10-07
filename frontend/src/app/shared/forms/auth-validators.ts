import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Regras de cadastro (auth.md §4). O backend continua sendo a autoridade.

/** Caracteres que contam como "especial" na senha. */
export const PASSWORD_SPECIALS = '!@#$%^&*()_+-=[]{};\':"\\|,.<>/?~`';
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export interface PasswordChecks {
  length: boolean;
  letter: boolean;
  digit: boolean;
  special: boolean;
}

/** Requisitos da senha; letras acentuadas e espaço não contam como letra nem especial. */
export function passwordChecks(password: string): PasswordChecks {
  return {
    length: password.length >= PASSWORD_MIN,
    letter: /[A-Za-z]/.test(password),
    digit: /[0-9]/.test(password),
    special: [...password].some((c) => PASSWORD_SPECIALS.includes(c)),
  };
}

export function strongPassword(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '');
  if (!value) return { required: true };
  if (value.length > PASSWORD_MAX) return { maxlength: { requiredLength: PASSWORD_MAX } };
  const checks = passwordChecks(value);
  return Object.values(checks).every(Boolean) ? null : { password: checks };
}

/** Nome como será gravado: sem espaços nas pontas e sem espaços repetidos. */
export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** Nome completo: 1 a 100 caracteres e ao menos 2 palavras. */
export function fullName(control: AbstractControl): ValidationErrors | null {
  const value = normalizeName(String(control.value ?? ''));
  if (!value) return { required: true };
  if (value.length > 100) return { maxlength: { requiredLength: 100 } };
  return value.split(' ').length >= 2 ? null : { fullName: true };
}

export const USERNAME_PATTERN = /^[A-Za-z0-9.-]{3,30}$/;

/** Username: 3 a 30 caracteres entre letras sem acento, números, "." e "-". */
export function usernameFormat(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  if (!value) return { required: true };
  return USERNAME_PATTERN.test(value) ? null : { username: true };
}

/** Validador de grupo: o campo `confirm` deve ser igual a `field` (erro `mismatch` no grupo). */
export function matchFields(field: string, confirm: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const a = group.get(field)?.value;
    const b = group.get(confirm)?.value;
    return !b || a === b ? null : { mismatch: true };
  };
}
