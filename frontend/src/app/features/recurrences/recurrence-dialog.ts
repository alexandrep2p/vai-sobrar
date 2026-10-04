import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { forkJoin } from 'rxjs';
import type { Category, PaymentMethod, Recurrence, RecurrenceInput } from '../../core/api/models';
import { Clock } from '../../core/clock';
import { CatalogService } from '../../core/data/catalog.service';
import { LedgerService } from '../../core/data/ledger.service';
import { centsToInput, parseCents } from '../../shared/format/money';
import { positiveMoney, trimmedLength } from '../../shared/forms/validators';
import { categoryTypeLabel } from '../../shared/labels/labels';

/** Criação e edição de recorrência. A edição só vale para ocorrências ainda não geradas. */
@Component({
  selector: 'app-recurrence-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInput,
    MatSelectModule,
    MatButton,
  ],
  template: `
    <h2 mat-dialog-title>{{ recurrence ? 'Editar recorrência' : 'Nova recorrência' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        @if (recurrence) {
          <p class="hint-text" data-testid="edit-hint">
            A alteração vale para as ocorrências ainda não geradas. As já geradas não mudam.
          </p>
        }
        <mat-form-field class="full-width">
          <mat-label>Descrição</mat-label>
          <input matInput formControlName="description" maxlength="200" autocomplete="off" />
          @if (form.controls.description.invalid) {
            <mat-error>Informe a descrição.</mat-error>
          }
        </mat-form-field>
        <mat-form-field class="full-width">
          <mat-label>Valor (R$)</mat-label>
          <input matInput formControlName="amount" inputmode="decimal" placeholder="0,00" />
          @if (form.controls.amount.invalid) {
            <mat-error>Informe um valor maior que zero.</mat-error>
          }
        </mat-form-field>
        <mat-form-field class="full-width">
          <mat-label>Categoria</mat-label>
          <mat-select formControlName="category_id">
            @for (category of categoryOptions(); track category.id) {
              <mat-option [value]="category.id"
                >{{ category.name }} ({{ typeLabel(category.type) }})</mat-option
              >
            }
          </mat-select>
          @if (form.controls.category_id.invalid) {
            <mat-error>Escolha a categoria.</mat-error>
          }
        </mat-form-field>
        <mat-form-field class="full-width">
          <mat-label>Método de pagamento</mat-label>
          <mat-select formControlName="payment_method_id">
            @for (method of methodOptions(); track method.id) {
              <mat-option [value]="method.id">{{ method.name }}</mat-option>
            }
          </mat-select>
          @if (form.controls.payment_method_id.invalid) {
            <mat-error>Escolha o método.</mat-error>
          }
        </mat-form-field>
        <div class="form-grid two">
          <mat-form-field>
            <mat-label>Dia do vencimento</mat-label>
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
          @if (!recurrence) {
            <mat-form-field>
              <mat-label>Início</mat-label>
              <input matInput type="date" formControlName="start_date" />
              @if (form.controls.start_date.invalid) {
                <mat-error>Informe a data de início.</mat-error>
              }
            </mat-form-field>
          }
          <mat-form-field>
            <mat-label>Término (opcional)</mat-label>
            <input matInput type="date" formControlName="end_date" />
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="loading() || submitting()">Salvar</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class RecurrenceDialog implements OnInit {
  protected readonly recurrence = inject<Recurrence | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly ref = inject(MatDialogRef<RecurrenceDialog, boolean>);
  private readonly catalog = inject(CatalogService);
  private readonly ledger = inject(LedgerService);

  protected readonly typeLabel = categoryTypeLabel;
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  private readonly categories = signal<Category[]>([]);
  private readonly methods = signal<PaymentMethod[]>([]);

  /** Categorias e métodos devem estar ativos; a escolha atual da recorrência também é listada. */
  protected readonly categoryOptions = computed(() =>
    this.categories().filter((c) => c.active || c.id === this.recurrence?.category.id),
  );
  protected readonly methodOptions = computed(() =>
    this.methods().filter((m) => m.active || m.id === this.recurrence?.payment_method.id),
  );

  protected readonly form = inject(FormBuilder).nonNullable.group({
    description: [this.recurrence?.description ?? '', trimmedLength(200)],
    amount: [this.recurrence ? centsToInput(this.recurrence.amount) : '', positiveMoney],
    category_id: [this.recurrence?.category.id ?? '', Validators.required],
    payment_method_id: [this.recurrence?.payment_method.id ?? '', Validators.required],
    due_day: [
      this.recurrence?.due_day ?? (null as number | null),
      [Validators.required, Validators.min(1), Validators.max(31)],
    ],
    start_date: [inject(Clock).today(), this.recurrence ? [] : Validators.required],
    end_date: [this.recurrence?.end_date ?? ''],
  });

  ngOnInit(): void {
    forkJoin([this.catalog.categories(), this.catalog.paymentMethods()]).subscribe({
      next: ([categories, methods]) => {
        this.categories.set(categories);
        this.methods.set(methods);
        this.loading.set(false);
      },
      error: () => this.ref.close(false),
    });
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: RecurrenceInput = {
      description: v.description.trim(),
      amount: parseCents(v.amount) as number,
      category_id: v.category_id,
      payment_method_id: v.payment_method_id,
      due_day: Number(v.due_day),
    };
    this.submitting.set(true);
    const request = this.recurrence
      ? this.ledger.updateRecurrence(this.recurrence.id, { ...body, end_date: v.end_date || null })
      : this.ledger.createRecurrence({
          ...body,
          start_date: v.start_date,
          ...(v.end_date && { end_date: v.end_date }),
        });
    request.subscribe({
      next: () => this.ref.close(true),
      error: () => this.submitting.set(false),
    });
  }
}
