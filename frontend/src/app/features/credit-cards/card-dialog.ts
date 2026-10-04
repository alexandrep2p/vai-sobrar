import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import type { CreditCard } from '../../core/api/models';
import { CatalogService } from '../../core/data/catalog.service';
import { trimmedLength } from '../../shared/forms/validators';

const dayValidators = [Validators.required, Validators.min(1), Validators.max(31)];

/** Cadastro e edição de cartão (nome, melhor dia de compra e dia de vencimento). */
@Component({
  selector: 'app-card-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInput, MatButton],
  template: `
    <h2 mat-dialog-title>{{ card ? 'Editar cartão' : 'Novo cartão' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        <mat-form-field class="full-width">
          <mat-label>Nome</mat-label>
          <input matInput formControlName="name" maxlength="100" autocomplete="off" />
          @if (form.controls.name.hasError('required')) {
            <mat-error>Informe o nome.</mat-error>
          }
        </mat-form-field>
        <div class="form-grid two">
          <mat-form-field>
            <mat-label>Melhor dia de compra</mat-label>
            <input
              matInput
              type="number"
              inputmode="numeric"
              min="1"
              max="31"
              formControlName="best_purchase_day"
            />
            @if (form.controls.best_purchase_day.invalid) {
              <mat-error>Informe um dia de 1 a 31.</mat-error>
            }
          </mat-form-field>
          <mat-form-field>
            <mat-label>Dia de vencimento</mat-label>
            <input
              matInput
              type="number"
              inputmode="numeric"
              min="1"
              max="31"
              formControlName="due_day"
            />
            @if (form.controls.due_day.invalid) {
              <mat-error>Informe um dia de 1 a 31.</mat-error>
            }
          </mat-form-field>
        </div>
        @if (card) {
          <p class="hint-text" data-testid="future-warning">
            As mudanças valem apenas para ciclos futuros: faturas já criadas mantêm o fechamento e o
            vencimento originais.
          </p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="submitting()">Salvar</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class CardDialog {
  protected readonly card = inject<CreditCard | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly ref = inject(MatDialogRef<CardDialog, boolean>);
  private readonly catalog = inject(CatalogService);
  protected readonly submitting = signal(false);

  protected readonly form = inject(FormBuilder).group({
    name: [this.card?.name ?? '', trimmedLength(100)],
    best_purchase_day: [this.card?.best_purchase_day ?? (null as number | null), dayValidators],
    due_day: [this.card?.due_day ?? (null as number | null), dayValidators],
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const body = {
      name: (value.name ?? '').trim(),
      best_purchase_day: Number(value.best_purchase_day),
      due_day: Number(value.due_day),
    };
    this.submitting.set(true);
    const request = this.card
      ? this.catalog.updateCreditCard(this.card.id, body)
      : this.catalog.createCreditCard(body);
    request.subscribe({
      next: () => this.ref.close(true),
      error: () => this.submitting.set(false),
    });
  }
}
