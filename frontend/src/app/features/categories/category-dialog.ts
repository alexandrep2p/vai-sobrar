import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TuiButton, TuiDataList, TuiDropdown, TuiError, TuiInput } from '@taiga-ui/core';
import { TuiChevron, TuiSelect } from '@taiga-ui/kit';
import type { Category } from '../../core/api/models';
import { CatalogService } from '../../core/data/catalog.service';
import { trimmedLength } from '../../shared/forms/validators';
import { categoryTypeLabel, type CategoryType } from '../../shared/labels/labels';
import { injectDialog } from '../../shared/ui/dialog';

/** Criação e edição de categoria. `data` é a categoria editada (ausente na criação). */
@Component({
  selector: 'app-category-dialog',
  imports: [
    ReactiveFormsModule,
    TuiButton,
    TuiInput,
    TuiError,
    TuiDataList,
    TuiDropdown,
    TuiChevron,
    TuiSelect,
  ],
  template: `
    <h2 class="dialog-title">{{ category ? 'Editar categoria' : 'Nova categoria' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="dialog-content">
        <div class="field full-width">
          <tui-textfield>
            <label tuiLabel>Nome</label>
            <input tuiInput formControlName="name" maxlength="100" autocomplete="off" />
          </tui-textfield>
          @if (form.controls.name.touched && form.controls.name.hasError('required')) {
            <tui-error error="Informe o nome." />
          }
        </div>
        <div class="field full-width">
          <tui-textfield tuiChevron [stringify]="label">
            <label tuiLabel>Tipo</label>
            <input tuiSelect formControlName="type" data-testid="type" />
            <tui-data-list *tuiDropdown>
              @for (type of types; track type) {
                <button tuiOption type="button" [value]="type">{{ label(type) }}</button>
              }
            </tui-data-list>
          </tui-textfield>
          @if (category?.in_use) {
            <p class="field-hint">O tipo não pode mudar enquanto a categoria estiver em uso.</p>
          }
        </div>
      </div>
      <footer class="dialog-actions">
        <button tuiButton appearance="flat" type="button" (click)="ref.close()">Cancelar</button>
        <button tuiButton type="submit" [disabled]="submitting() || form.invalid">Salvar</button>
      </footer>
    </form>
  `,
})
export class CategoryDialog {
  protected readonly ref = injectDialog<Category | null, boolean>();
  protected readonly category = this.ref.data ?? null;
  private readonly catalog = inject(CatalogService);
  protected readonly types: CategoryType[] = ['INCOME', 'EXPENSE'];
  protected readonly label = categoryTypeLabel;
  protected readonly submitting = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.category?.name ?? '', trimmedLength(100)],
    type: [this.category?.type ?? ('EXPENSE' as CategoryType)],
  });

  constructor() {
    if (this.category?.in_use) this.form.controls.type.disable();
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, type } = this.form.getRawValue();
    this.submitting.set(true);
    const request = this.category
      ? this.catalog.updateCategory(this.category.id, {
          name: name.trim(),
          ...(type !== this.category.type && { type }),
        })
      : this.catalog.createCategory({ name: name.trim(), type });
    request.subscribe({
      next: () => this.ref.close(true),
      error: () => this.submitting.set(false),
    });
  }
}
