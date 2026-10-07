import type { AbstractControl, FormGroupDirective, NgForm } from '@angular/forms';
import type { ErrorStateMatcher } from '@angular/material/core';

/**
 * Mostra o erro do campo de confirmação também quando o grupo tem `mismatch`
 * (o erro é do grupo, não do campo). Demais campos seguem o padrão do Material.
 */
export const mismatchMatcher: ErrorStateMatcher = {
  isErrorState(control: AbstractControl | null, form: FormGroupDirective | NgForm | null) {
    if (!control) return false;
    const touched = control.touched || !!form?.submitted;
    const isConfirm = control.parent?.get('confirm') === control;
    const mismatch = isConfirm && !!control.parent?.hasError('mismatch');
    return touched && (control.invalid || mismatch);
  },
};
