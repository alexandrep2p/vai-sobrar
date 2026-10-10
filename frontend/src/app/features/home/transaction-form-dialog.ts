import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiButton, TuiDataList, TuiDropdown, TuiError, TuiInput } from '@taiga-ui/core';
import { TuiChevron, TuiInputDate, TuiSegmented, TuiSelect } from '@taiga-ui/kit';
import { catchError, forkJoin, map, of, switchMap, type Observable } from 'rxjs';
import type {
  Category,
  CreditCard,
  PaymentMethod,
  PostingPreview,
  TransactionInput,
} from '../../core/api/models';
import { CatalogService } from '../../core/data/catalog.service';
import { LedgerService } from '../../core/data/ledger.service';
import { Clock } from '../../core/clock';
import { formatDate, formatMonthShort } from '../../shared/format/dates';
import { describeInstallments } from '../../shared/format/installments';
import { formatCents, parseCents } from '../../shared/format/money';
import { ISO_DATE_INPUTS } from '../../shared/forms/iso-dates';
import { nameById } from '../../shared/forms/options';
import { positiveMoney, trimmedLength } from '../../shared/forms/validators';
import { MoneyInput } from '../../shared/forms/money-input';
import { categoryTypeLabel, type CategoryType } from '../../shared/labels/labels';
import { AppDialog, injectDialog } from '../../shared/ui/dialog';
import { confirmSummary, type SummaryRow } from '../../shared/ui/summary-dialog';

/**
 * Modal "+ Lançamento" (home.md §7): entrada/saída, descrição, valor, data, categoria e método.
 * Para cartão: data da compra e parcelas (1 = à vista; ≥ 2 = parcelado).
 */
@Component({
  selector: 'app-transaction-form-dialog',
  imports: [
    TuiInputDate,
    ReactiveFormsModule,
    MoneyInput,
    TuiButton,
    TuiInput,
    TuiError,
    TuiDataList,
    TuiDropdown,
    TuiChevron,
    TuiSelect,
    TuiSegmented,
  ],
  providers: [ISO_DATE_INPUTS],
  template: `
    <h2 class="dialog-title">Novo lançamento</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="dialog-content">
        @if (loading()) {
          <p class="hint-text">Carregando…</p>
        } @else {
          <tui-segmented class="type-toggle" role="radiogroup" aria-label="Tipo">
            @for (type of types; track type) {
              <label>
                <input type="radio" formControlName="type" [value]="type" />
                {{ typeLabel(type) }}
              </label>
            }
          </tui-segmented>
          <div class="field full-width">
            <tui-textfield>
              <label tuiLabel>Descrição</label>
              <input tuiInput formControlName="description" maxlength="200" autocomplete="off" />
            </tui-textfield>
            @if (form.controls.description.touched && form.controls.description.invalid) {
              <tui-error error="Informe a descrição." />
            }
          </div>
          <div class="field full-width">
            <tui-textfield>
              <label tuiLabel>Valor (R$)</label>
              <input tuiInput appMoneyInput formControlName="amount" placeholder="0,00" />
            </tui-textfield>
            @if (form.controls.amount.touched && form.controls.amount.invalid) {
              <tui-error error="Informe um valor maior que zero." />
            }
          </div>
          <div class="field full-width">
            <tui-textfield tuiChevron [stringify]="categoryName">
              <label tuiLabel>Categoria</label>
              <input tuiSelect formControlName="category_id" data-testid="category_id" />
              <tui-data-list *tuiDropdown>
                @for (category of categoryOptions(); track category.id) {
                  <button tuiOption type="button" [value]="category.id">{{ category.name }}</button>
                }
              </tui-data-list>
            </tui-textfield>
            @if (form.controls.category_id.touched && form.controls.category_id.invalid) {
              <tui-error error="Escolha a categoria." />
            }
          </div>
          <div class="field full-width">
            <tui-textfield tuiChevron [stringify]="methodName">
              <label tuiLabel>Método de pagamento</label>
              <input
                tuiSelect
                formControlName="payment_method_id"
                data-testid="payment_method_id"
              />
              <tui-data-list *tuiDropdown>
                @for (method of methods(); track method.id) {
                  <button tuiOption type="button" [value]="method.id">{{ method.name }}</button>
                }
              </tui-data-list>
            </tui-textfield>
            @if (
              form.controls.payment_method_id.touched && form.controls.payment_method_id.invalid
            ) {
              <tui-error error="Escolha o método." />
            }
          </div>
          <div class="form-grid two">
            <div class="field">
              <tui-textfield>
                <label tuiLabel>{{ isCard() ? 'Data da compra' : 'Data' }}</label>
                <input tuiInputDate formControlName="date" />
                <tui-calendar *tuiDropdown />
              </tui-textfield>
              @if (form.controls.date.touched && form.controls.date.invalid) {
                <tui-error error="Informe a data." />
              }
            </div>
            @if (isCard()) {
              <div class="field">
                <tui-textfield>
                  <label tuiLabel>Parcelas</label>
                  <input
                    tuiInput
                    type="number"
                    inputmode="numeric"
                    min="1"
                    max="120"
                    formControlName="installments"
                  />
                </tui-textfield>
                @if (form.controls.installments.touched && form.controls.installments.invalid) {
                  <tui-error error="Informe de 1 a 120." />
                }
                <p class="field-hint">1 = à vista</p>
              </div>
            }
          </div>
        }
      </div>
      <footer class="dialog-actions">
        <button tuiButton appearance="flat" type="button" (click)="ref.close()">Cancelar</button>
        <button tuiButton type="submit" [disabled]="loading() || submitting() || form.invalid">
          Salvar
        </button>
      </footer>
    </form>
  `,
})
export class TransactionFormDialog implements OnInit {
  protected readonly ref = injectDialog<undefined, boolean>();
  private readonly catalog = inject(CatalogService);
  private readonly dialog = inject(AppDialog);
  private readonly ledger = inject(LedgerService);
  private readonly clock = inject(Clock);

  protected readonly types: CategoryType[] = ['EXPENSE', 'INCOME'];
  protected readonly typeLabel = categoryTypeLabel;
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly categories = signal<Category[]>([]);
  protected readonly methods = signal<PaymentMethod[]>([]);
  private readonly cards = signal<CreditCard[]>([]);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    type: ['EXPENSE' as CategoryType],
    description: ['', trimmedLength(200)],
    amount: ['', positiveMoney],
    category_id: ['', Validators.required],
    payment_method_id: ['', Validators.required],
    date: [this.clock.today(), Validators.required],
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
  protected readonly categoryName = nameById(this.categories);
  protected readonly methodName = nameById(this.methods);
  protected readonly isCard = computed(
    () => this.methods().find((m) => m.id === this.methodId())?.kind === 'CREDIT_CARD',
  );

  ngOnInit(): void {
    forkJoin([
      this.catalog.categories(),
      this.catalog.paymentMethods(),
      this.catalog.creditCards(),
    ]).subscribe({
      next: ([categories, methods, cards]) => {
        this.categories.set(categories);
        this.methods.set(methods.filter((m) => m.active));
        this.cards.set(cards);
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
    this.previewInvoice(v.payment_method_id, v.date)
      .pipe(
        switchMap((preview) =>
          confirmSummary(this.dialog, {
            title: 'Confirmar lançamento',
            rows: this.summaryRows(v, body, preview),
            confirmLabel: 'Confirmar',
          }),
        ),
      )
      .subscribe((confirmed) => {
        if (confirmed) this.send(body);
      });
  }

  /** Fatura em que a compra de cartão cairá (mesma regra da postagem real); `null` se indisponível. */
  private previewInvoice(methodId: string, date: string): Observable<PostingPreview | null> {
    const card = this.isCard()
      ? this.cards().find((c) => c.payment_method_id === methodId)
      : undefined;
    if (!card) return of(null);
    return this.ledger.postingPreview(card.id, date).pipe(
      map((preview): PostingPreview | null => preview),
      catchError(() => of(null)),
    );
  }

  private send(body: TransactionInput): void {
    this.submitting.set(true);
    this.ledger.createTransaction(body).subscribe({
      next: () => this.ref.close(true),
      error: () => this.submitting.set(false),
    });
  }

  private summaryRows(
    v: { type: CategoryType; category_id: string; payment_method_id: string; date: string },
    body: TransactionInput,
    preview: PostingPreview | null,
  ): SummaryRow[] {
    const isCard = this.isCard();
    const rows: SummaryRow[] = [
      { label: 'Tipo', value: this.typeLabel(v.type) },
      { label: 'Descrição', value: body.description },
      { label: 'Valor', value: formatCents(body.amount) },
      {
        label: 'Categoria',
        value: this.categories().find((c) => c.id === v.category_id)?.name ?? '',
      },
      {
        label: 'Método',
        value: this.methods().find((m) => m.id === v.payment_method_id)?.name ?? '',
      },
      { label: isCard ? 'Data da compra' : 'Vencimento', value: formatDate(v.date) },
    ];
    const method = this.methods().find((m) => m.id === v.payment_method_id);
    if (!isCard && method?.source === 'SYSTEM') {
      // PD-42: PIX/Dinheiro/Débito já saíram da conta; data futura segue em aberto.
      rows.push({ label: 'Situação', value: v.date <= this.clock.today() ? 'Pago' : 'Em aberto' });
    }
    if (isCard) {
      const count = body.installment_count ?? 1;
      rows.push({
        label: 'Parcelas',
        value: count >= 2 ? describeInstallments(body.amount, count) : 'À vista',
      });
      if (preview) {
        rows.push({
          label: count >= 2 ? 'Primeira fatura' : 'Fatura',
          value: `${formatMonthShort(preview.reference_month)} (vence ${formatDate(preview.due_date)})`,
        });
      }
    }
    return rows;
  }
}
