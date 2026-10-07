import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiButton, TuiError, TuiInput } from '@taiga-ui/core';
import { TuiInputDate } from '@taiga-ui/kit';
import type { Recurrence } from '../../core/api/models';
import { Clock } from '../../core/clock';
import { LedgerService } from '../../core/data/ledger.service';
import { ISO_DATE_INPUTS } from '../../shared/forms/iso-dates';
import { injectDialog } from '../../shared/ui/dialog';

/** Pausa de recorrência ativa: início (hoje ou futuro) e retorno opcional (recurrences.md §11). */
@Component({
  selector: 'app-pause-dialog',
  imports: [TuiInputDate, ReactiveFormsModule, TuiButton, TuiInput, TuiError],
  providers: [ISO_DATE_INPUTS],
  template: `
    <h2 class="dialog-title">Pausar {{ recurrence.description }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="dialog-content">
        <div class="field full-width">
          <tui-textfield>
            <label tuiLabel>Início da pausa</label>
            <input tuiInputDate formControlName="paused_from" />
            <tui-calendar *tuiDropdown />
          </tui-textfield>
          @if (form.controls.paused_from.touched && form.controls.paused_from.invalid) {
            <tui-error error="Informe a data." />
          }
        </div>
        <div class="field full-width">
          <tui-textfield>
            <label tuiLabel>Retorno (opcional)</label>
            <input tuiInputDate formControlName="paused_until" />
            <tui-calendar *tuiDropdown />
          </tui-textfield>
          <p class="field-hint">Sem retorno, a pausa dura até você retomar.</p>
        </div>
      </div>
      <footer class="dialog-actions">
        <button tuiButton appearance="flat" type="button" (click)="ref.close()">Cancelar</button>
        <button tuiButton type="submit" [disabled]="submitting() || form.invalid">Pausar</button>
      </footer>
    </form>
  `,
})
export class PauseDialog {
  protected readonly ref = injectDialog<Recurrence, boolean>();
  protected readonly recurrence = this.ref.data;
  private readonly ledger = inject(LedgerService);
  protected readonly submitting = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    paused_from: [inject(Clock).today(), Validators.required],
    paused_until: [''],
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { paused_from, paused_until } = this.form.getRawValue();
    this.submitting.set(true);
    this.ledger
      .pauseRecurrence(this.recurrence.id, {
        paused_from,
        ...(paused_until && { paused_until }),
      })
      .subscribe({
        next: () => this.ref.close(true),
        error: () => this.submitting.set(false),
      });
  }
}
