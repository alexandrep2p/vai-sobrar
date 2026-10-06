import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { TuiButton } from '@taiga-ui/core';
import type { Recurrence } from '../../core/api/models';
import { Clock } from '../../core/clock';
import { LedgerService } from '../../core/data/ledger.service';
import { injectDialog } from '../../shared/ui/dialog';

/** Pausa de recorrência ativa: início (hoje ou futuro) e retorno opcional (recurrences.md §11). */
@Component({
  selector: 'app-pause-dialog',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInput, TuiButton],
  template: `
    <h2 class="dialog-title">Pausar {{ recurrence.description }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="dialog-content">
        <mat-form-field class="full-width">
          <mat-label>Início da pausa</mat-label>
          <input matInput type="date" formControlName="paused_from" />
          @if (form.controls.paused_from.invalid) {
            <mat-error>Informe a data.</mat-error>
          }
        </mat-form-field>
        <mat-form-field class="full-width">
          <mat-label>Retorno (opcional)</mat-label>
          <input matInput type="date" formControlName="paused_until" />
          <mat-hint>Sem retorno, a pausa dura até você retomar.</mat-hint>
        </mat-form-field>
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
