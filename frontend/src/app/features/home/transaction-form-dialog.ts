import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { forkJoin } from 'rxjs';
import type { Category, PaymentMethod, TransactionInput } from '../../core/api/models';
import { CatalogService } from '../../core/data/catalog.service';
import { LedgerService } from '../../core/data/ledger.service';
import { Clock } from '../../core/clock';
import { parseCents } from '../../shared/format/money';
import { positiveMoney, trimmedLength } from '../../shared/forms/validators';
import { categoryTypeLabel, type CategoryType } from '../../shared/labels/labels';

/**
 * Modal "+ Lançamento" (home.md §7): entrada/saída, descrição, valor, data, categoria e método.
 * Para cartão: data da compra e parcelas (1 = à vista; ≥ 2 = parcelado).
 */
@Component({
  selector: 'app-transaction-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInput,
    MatSelectModule,
    MatButtonToggleModule,
    MatButton,
  ],
  template: `
    <h2 mat-dialog-title>Novo lançamento</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        @if (loading()) {
          <p class="hint-text">Carregando…</p>
        } @else {
          <mat-button-toggle-group class="full-width" formControlName="type" aria-label="Tipo">
            @for (type of types; track type) {
              <mat-button-toggle [value]="type">{{ typeLabel(type) }}</mat-button-toggle>
            }
          </mat-button-toggle-group>
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
                <mat-option [value]="category.id">{{ category.name }}</mat-option>
              }
            </mat-select>
            @if (form.controls.category_id.invalid) {
              <mat-error>Escolha a categoria.</mat-error>
            }
          </mat-form-field>
          <mat-form-field class="full-width">
            <mat-label>Método de pagamento</mat-label>
            <mat-select formControlName="payment_method_id">
              @for (method of methods(); track method.id) {
                <mat-option [value]="method.id">{{ method.name }}</mat-option>
              }
            </mat-select>
            @if (form.controls.payment_method_id.invalid) {
              <mat-error>Escolha o método.</mat-error>
            }
          </mat-form-field>
          <div class="form-grid two">
            <mat-form-field>
              <mat-label>{{ isCard() ? 'Data da compra' : 'Data' }}</mat-label>
              <input matInput type="date" formControlName="date" />
              @if (form.controls.date.invalid) {
                <mat-error>Informe a data.</mat-error>
              }
            </mat-form-field>
            @if (isCard()) {
              <mat-form-field>
                <mat-label>Parcelas</mat-label>
                <input
                  matInput
                  type="number"
                  inputmode="numeric"
                  min="1"
                  max="120"
                  formControlName="installments"
                />
                <mat-hint>1 = à vista</mat-hint>
                @if (form.controls.installments.invalid) {
                  <mat-error>Informe de 1 a 120.</mat-error>
                }
              </mat-form-field>
            }
          </div>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="loading() || submitting()">Salvar</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class TransactionFormDialog implements OnInit {
  private readonly ref = inject(MatDialogRef<TransactionFormDialog, boolean>);
  private readonly catalog = inject(CatalogService);
  private readonly ledger = inject(LedgerService);

  protected readonly types: CategoryType[] = ['EXPENSE', 'INCOME'];
  protected readonly typeLabel = categoryTypeLabel;
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly categories = signal<Category[]>([]);
  protected readonly methods = signal<PaymentMethod[]>([]);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    type: ['EXPENSE' as CategoryType],
    description: ['', trimmedLength(200)],
    amount: ['', positiveMoney],
    category_id: ['', Validators.required],
    payment_method_id: ['', Validators.required],
    date: [inject(Clock).today(), Validators.required],
    installments: [1, [Validators.required, Validators.min(1), Validators.max(120)]],
  });

  private readonly type = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.form.controls.type.value,
  });
  private readonly methodId = toSignal(this.form.controls.payment_method_id.valueChanges, {
    initialValue: '',
  });

  protected readonly categoryOptions = computed(() =>
    this.categories().filter((c) => c.active && c.type === this.type()),
  );
  protected readonly isCard = computed(
    () => this.methods().find((m) => m.id === this.methodId())?.kind === 'CREDIT_CARD',
  );

  ngOnInit(): void {
    forkJoin([this.catalog.categories(), this.catalog.paymentMethods()]).subscribe({
      next: ([categories, methods]) => {
        this.categories.set(categories);
        this.methods.set(methods.filter((m) => m.active));
        this.loading.set(false);
      },
      error: () => this.ref.close(false),
    });
    // A categoria escolhida deixa de valer quando o tipo muda.
    this.form.controls.type.valueChanges.subscribe(() => this.form.controls.category_id.reset(''));
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: TransactionInput = {
      description: v.description.trim(),
      amount: parseCents(v.amount) as number,
      category_id: v.category_id,
      payment_method_id: v.payment_method_id,
    };
    if (this.isCard()) {
      body.purchase_date = v.date;
      if (Number(v.installments) >= 2) body.installment_count = Number(v.installments);
    } else {
      body.due_date = v.date;
    }
    this.submitting.set(true);
    this.ledger.createTransaction(body).subscribe({
      next: () => this.ref.close(true),
      error: () => this.submitting.set(false),
    });
  }
}
