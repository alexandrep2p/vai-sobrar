import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TuiButton } from '@taiga-ui/core';
import { forkJoin, Observable } from 'rxjs';
import type { Category, PaymentMethod, StatementItem } from '../../core/api/models';
import { CatalogService } from '../../core/data/catalog.service';
import { LedgerService } from '../../core/data/ledger.service';
import { formatDate } from '../../shared/format/dates';
import { centsToInput, formatCents, parseCents } from '../../shared/format/money';
import { positiveMoney, trimmedLength } from '../../shared/forms/validators';
import { MoneyInput } from '../../shared/forms/money-input';
import { AppDialog, injectDialog } from '../../shared/ui/dialog';
import { confirmSummary, type SummaryRow } from '../../shared/ui/summary-dialog';
import { editableFields } from './item-actions';

/**
 * Edição de um item do extrato. Mostra apenas os campos permitidos pela origem
 * (transactions.md §12, recurrences.md §9, installments.md §9); o backend valida o restante.
 */
@Component({
  selector: 'app-transaction-edit-dialog',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInput,
    MoneyInput,
    MatSelectModule,
    TuiButton,
  ],
  template: `
    <h2 class="dialog-title">Editar lançamento</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="dialog-content">
        @if (isPlan) {
          <p class="hint-text" data-testid="plan-hint">
            A alteração vale para todas as parcelas da compra.
          </p>
        }
        <mat-form-field class="full-width">
          <mat-label>Descrição</mat-label>
          <input matInput formControlName="description" maxlength="200" autocomplete="off" />
          @if (form.controls.description.invalid) {
            <mat-error>Informe a descrição.</mat-error>
          }
        </mat-form-field>
        @if (fields.amount) {
          <mat-form-field class="full-width">
            <mat-label>Valor (R$)</mat-label>
            <input matInput appMoneyInput formControlName="amount" />
            @if (form.controls.amount.invalid) {
              <mat-error>Informe um valor maior que zero.</mat-error>
            }
          </mat-form-field>
        }
        @if (fields.dueDate) {
          <mat-form-field class="full-width">
            <mat-label>Vencimento</mat-label>
            <input matInput type="date" formControlName="due_date" />
          </mat-form-field>
        }
        @if (fields.category) {
          <mat-form-field class="full-width">
            <mat-label>Categoria</mat-label>
            <mat-select formControlName="category_id">
              @for (category of categoryOptions(); track category.id) {
                <mat-option [value]="category.id">{{ category.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
        @if (fields.method) {
          <mat-form-field class="full-width">
            <mat-label>Método de pagamento</mat-label>
            <mat-select formControlName="payment_method_id">
              @for (method of methodOptions(); track method.id) {
                <mat-option [value]="method.id">{{ method.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
      </div>
      <footer class="dialog-actions">
        <button tuiButton appearance="flat" type="button" (click)="ref.close()">Cancelar</button>
        <button tuiButton type="submit" [disabled]="submitting() || form.invalid">Salvar</button>
      </footer>
    </form>
  `,
})
export class TransactionEditDialog implements OnInit {
  protected readonly ref = injectDialog<StatementItem, boolean>();
  protected readonly item = this.ref.data;
  private readonly catalog = inject(CatalogService);
  private readonly dialog = inject(AppDialog);
  private readonly ledger = inject(LedgerService);

  protected readonly fields = editableFields(this.item);
  protected readonly isPlan = this.item.installment !== null;
  protected readonly submitting = signal(false);
  private readonly categories = signal<Category[]>([]);
  private readonly methods = signal<PaymentMethod[]>([]);

  /** Categorias ativas do mesmo tipo (a natureza do lançamento) e a categoria atual. */
  protected readonly categoryOptions = computed(() =>
    this.categories().filter(
      (c) => c.id === this.item.category.id || (c.active && c.type === this.item.nature),
    ),
  );
  /** Somente métodos comuns ativos (e o atual). */
  protected readonly methodOptions = computed(() =>
    this.methods().filter(
      (m) => m.id === this.item.payment_method.id || (m.active && m.kind === 'STANDARD'),
    ),
  );

  protected readonly form = inject(FormBuilder).nonNullable.group({
    description: [this.item.description, trimmedLength(200)],
    amount: [centsToInput(this.item.amount), this.fields.amount ? positiveMoney : []],
    due_date: [
      this.item.due_date ?? this.item.display_date,
      this.fields.dueDate ? Validators.required : [],
    ],
    category_id: [this.item.category.id],
    payment_method_id: [this.item.payment_method.id],
  });

  ngOnInit(): void {
    if (!this.fields.category && !this.fields.method) return;
    forkJoin([this.catalog.categories(), this.catalog.paymentMethods()]).subscribe(
      ([categories, methods]) => {
        this.categories.set(categories);
        this.methods.set(methods);
      },
    );
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const item = this.item;
    const changes: Record<string, string | number> = {};
    if (v.description.trim() !== item.description) changes['description'] = v.description.trim();
    if (this.fields.amount) {
      const cents = parseCents(v.amount) as number;
      if (cents !== item.amount) changes['amount'] = cents;
    }
    if (this.fields.dueDate && v.due_date !== (item.due_date ?? item.display_date)) {
      changes['due_date'] = v.due_date;
    }
    if (this.fields.category && v.category_id !== item.category.id) {
      changes['category_id'] = v.category_id;
    }
    if (this.fields.method && v.payment_method_id !== item.payment_method.id) {
      changes['payment_method_id'] = v.payment_method_id;
    }
    if (Object.keys(changes).length === 0) {
      this.ref.close(false);
      return;
    }
    confirmSummary(this.dialog, {
      title: 'Confirmar alterações',
      rows: this.summaryRows(changes),
      confirmLabel: 'Confirmar',
    }).subscribe((confirmed) => {
      if (confirmed) this.send(changes);
    });
  }

  private send(changes: Record<string, string | number>): void {
    this.submitting.set(true);
    this.request(changes).subscribe({
      next: () => this.ref.close(true),
      error: () => this.submitting.set(false),
    });
  }

  /** Cada campo alterado como "antes → depois". */
  private summaryRows(changes: Record<string, string | number>): SummaryRow[] {
    const item = this.item;
    const name = (list: { id: string; name: string }[], id: string) =>
      list.find((x) => x.id === id)?.name ?? '';
    const rows: SummaryRow[] = [{ label: 'Lançamento', value: item.description }];
    const change = (label: string, before: string, after: string) =>
      rows.push({ label, value: `${before} → ${after}` });
    if ('description' in changes)
      change('Descrição', item.description, String(changes['description']));
    if ('amount' in changes)
      change('Valor', formatCents(item.amount), formatCents(Number(changes['amount'])));
    if ('due_date' in changes) {
      change(
        'Vencimento',
        formatDate(item.due_date ?? item.display_date),
        formatDate(String(changes['due_date'])),
      );
    }
    if ('category_id' in changes) {
      change(
        'Categoria',
        item.category.name,
        name(this.categories(), String(changes['category_id'])),
      );
    }
    if ('payment_method_id' in changes) {
      change(
        'Método',
        item.payment_method.name,
        name(this.methods(), String(changes['payment_method_id'])),
      );
    }
    return rows;
  }

  private request(changes: Record<string, string | number>): Observable<unknown> {
    const item = this.item;
    if (item.installment)
      return this.ledger.updatePlan(item.installment.installment_plan_id, changes);
    if (item.recurrence_id && item.occurrence_month) {
      // categoria pertence à recorrência e não é enviada (já não é editável aqui)
      return this.ledger.editOccurrence(item.recurrence_id, item.occurrence_month, changes);
    }
    return this.ledger.updateTransaction(item.transaction_id as string, changes);
  }
}
