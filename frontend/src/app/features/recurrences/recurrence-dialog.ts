import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiButton, TuiDataList, TuiDropdown, TuiError, TuiInput } from '@taiga-ui/core';
import { TuiChevron, TuiInputDate, TuiSelect } from '@taiga-ui/kit';
import { catchError, distinctUntilChanged, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import type {
  Category,
  CreditCard,
  PaymentMethod,
  Recurrence,
  RecurrenceInput,
} from '../../core/api/models';
import { Clock } from '../../core/clock';
import { CatalogService } from '../../core/data/catalog.service';
import { LedgerService } from '../../core/data/ledger.service';
import { formatDate, formatMonthShort, nextOccurrenceDate } from '../../shared/format/dates';
import { centsToInput, formatCents, parseCents } from '../../shared/format/money';
import { ISO_DATE_INPUTS } from '../../shared/forms/iso-dates';
import { nameById } from '../../shared/forms/options';
import { positiveMoney, trimmedLength } from '../../shared/forms/validators';
import { MoneyInput } from '../../shared/forms/money-input';
import { categoryTypeLabel } from '../../shared/labels/labels';
import { AppDialog, injectDialog } from '../../shared/ui/dialog';
import { confirmSummary } from '../../shared/ui/summary-dialog';

/** Criação e edição de recorrência. A edição só vale para ocorrências ainda não geradas. */
@Component({
  selector: 'app-recurrence-dialog',
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
  ],
  providers: [ISO_DATE_INPUTS],
  template: `
    <h2 class="dialog-title">{{ recurrence ? 'Editar recorrência' : 'Nova recorrência' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="dialog-content">
        @if (recurrence) {
          <p class="hint-text" data-testid="edit-hint">
            A alteração vale para as ocorrências ainda não geradas. As já geradas não mudam.
          </p>
        }
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
                <button tuiOption type="button" [value]="category.id">
                  {{ category.name }} ({{ typeLabel(category.type) }})
                </button>
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
            <input tuiSelect formControlName="payment_method_id" data-testid="payment_method_id" />
            <tui-data-list *tuiDropdown>
              @for (method of methodOptions(); track method.id) {
                <button tuiOption type="button" [value]="method.id">{{ method.name }}</button>
              }
            </tui-data-list>
          </tui-textfield>
          @if (form.controls.payment_method_id.touched && form.controls.payment_method_id.invalid) {
            <tui-error error="Escolha o método." />
          }
        </div>
        <div class="form-grid two">
          <div class="field">
            <tui-textfield>
              <label tuiLabel>{{ dayLabel() }}</label>
              <input
                tuiInput
                type="number"
                inputmode="numeric"
                min="1"
                max="31"
                formControlName="due_day"
              />
            </tui-textfield>
            @if (form.controls.due_day.touched && form.controls.due_day.invalid) {
              <tui-error error="Informe um dia de 1 a 31." />
            }
          </div>
          @if (!recurrence) {
            <div class="field">
              <tui-textfield>
                <label tuiLabel>Início</label>
                <input tuiInputDate formControlName="start_date" />
                <tui-calendar *tuiDropdown />
              </tui-textfield>
              @if (form.controls.start_date.touched && form.controls.start_date.invalid) {
                <tui-error error="Informe a data de início." />
              }
            </div>
          }
          <div class="field">
            <tui-textfield>
              <label tuiLabel>Término (opcional)</label>
              <input tuiInputDate formControlName="end_date" />
              <tui-calendar *tuiDropdown />
            </tui-textfield>
          </div>
        </div>
        @if (cardHint(); as hint) {
          <p class="hint-text" data-testid="card-hint">{{ hint }}</p>
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
export class RecurrenceDialog implements OnInit {
  protected readonly ref = injectDialog<Recurrence | null, boolean>();
  protected readonly recurrence = this.ref.data ?? null;
  private readonly catalog = inject(CatalogService);
  private readonly dialog = inject(AppDialog);
  private readonly ledger = inject(LedgerService);

  protected readonly typeLabel = categoryTypeLabel;
  private readonly today = inject(Clock).today();
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  private readonly categories = signal<Category[]>([]);
  private readonly methods = signal<PaymentMethod[]>([]);
  private readonly cards = signal<CreditCard[]>([]);
  protected readonly cardHint = signal<string | null>(null);

  /** Categorias e métodos devem estar ativos; a escolha atual da recorrência também é listada. */
  protected readonly categoryOptions = computed(() =>
    this.categories().filter((c) => c.active || c.id === this.recurrence?.category.id),
  );
  protected readonly methodOptions = computed(() =>
    this.methods().filter((m) => m.active || m.id === this.recurrence?.payment_method.id),
  );
  /** Texto do select de categoria: nome e tipo, como nas opções. */
  protected readonly categoryName = (id: string): string => {
    const category = this.categories().find((c) => c.id === id);
    return category ? `${category.name} (${this.typeLabel(category.type)})` : '';
  };
  protected readonly methodName = nameById(this.methods);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    description: [this.recurrence?.description ?? '', trimmedLength(200)],
    amount: [this.recurrence ? centsToInput(this.recurrence.amount) : '', positiveMoney],
    category_id: [this.recurrence?.category.id ?? '', Validators.required],
    payment_method_id: [this.recurrence?.payment_method.id ?? '', Validators.required],
    due_day: [
      this.recurrence?.due_day ?? (null as number | null),
      [Validators.required, Validators.min(1), Validators.max(31)],
    ],
    start_date: [this.today, this.recurrence ? [] : Validators.required],
    end_date: [this.recurrence?.end_date ?? ''],
  });

  private readonly categoryId = toSignal(this.form.controls.category_id.valueChanges, {
    initialValue: this.form.controls.category_id.value,
  });
  private readonly methodId = toSignal(this.form.controls.payment_method_id.valueChanges, {
    initialValue: this.form.controls.payment_method_id.value,
  });

  /** Cartão da recorrência, quando o método escolhido é um cartão. */
  private readonly card = computed(() => {
    const method = this.methods().find((m) => m.id === this.methodId());
    return method?.kind === 'CREDIT_CARD'
      ? (this.cards().find((c) => c.payment_method_id === method.id) ?? null)
      : null;
  });

  /** PD-34: o mesmo campo (`due_day`) tem rótulo conforme o contexto. */
  protected readonly dayLabel = computed(() => {
    if (this.card()) return 'Dia da cobrança';
    const category = this.categories().find((c) => c.id === this.categoryId());
    return category?.type === 'INCOME' ? 'Dia do recebimento' : 'Dia do vencimento';
  });

  ngOnInit(): void {
    forkJoin([
      this.catalog.categories(),
      this.catalog.paymentMethods(),
      this.catalog.creditCards(),
    ]).subscribe({
      next: ([categories, methods, cards]) => {
        this.categories.set(categories);
        this.methods.set(methods);
        this.cards.set(cards);
        this.loading.set(false);
        this.form.updateValueAndValidity(); // reavalia a dica da fatura com os dados carregados
      },
      error: () => this.ref.close(false),
    });
    this.watchCardHint();
  }

  /**
   * No cartão, a ocorrência é uma compra na data da cobrança (PD-09): mostra em qual fatura ela
   * cairá. A fatura vem do backend (mesma regra da postagem real); aqui só se escolhe a data.
   */
  private watchCardHint(): void {
    const today = this.today;
    this.form.valueChanges
      .pipe(
        startWith(null),
        map(() => {
          const card = this.card();
          const day = Number(this.form.controls.due_day.value);
          if (!card || !Number.isInteger(day) || day < 1 || day > 31) return null;
          const start = this.recurrence ? today : this.form.controls.start_date.value || today;
          return { cardId: card.id, date: nextOccurrenceDate(day, start > today ? start : today) };
        }),
        distinctUntilChanged((a, b) => a?.cardId === b?.cardId && a?.date === b?.date),
        switchMap((key) =>
          key
            ? this.ledger.postingPreview(key.cardId, key.date).pipe(
                map(
                  (p) =>
                    `Cobrança em ${formatDate(key.date)}: cairá na fatura de ${formatMonthShort(p.reference_month)} (vence ${formatDate(p.due_date)}).`,
                ),
                catchError(() => of(null)),
              )
            : of(null),
        ),
      )
      .subscribe((hint) => this.cardHint.set(hint));
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
    const name = (list: { id: string; name: string }[], id: string) =>
      list.find((x) => x.id === id)?.name ?? '';
    confirmSummary(this.dialog, {
      title: this.recurrence ? 'Confirmar alterações da recorrência' : 'Confirmar recorrência',
      rows: [
        { label: 'Descrição', value: body.description },
        { label: 'Valor', value: formatCents(body.amount) },
        { label: 'Categoria', value: name(this.categories(), body.category_id) },
        { label: 'Método', value: name(this.methods(), body.payment_method_id) },
        { label: this.dayLabel(), value: String(body.due_day) },
        ...(this.recurrence ? [] : [{ label: 'Início', value: formatDate(v.start_date) }]),
        { label: 'Término', value: v.end_date ? formatDate(v.end_date) : 'Sem término' },
      ],
      confirmLabel: 'Confirmar',
    }).subscribe((confirmed) => {
      if (confirmed) this.send(body, v);
    });
  }

  private send(body: RecurrenceInput, v: { start_date: string; end_date: string }): void {
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
