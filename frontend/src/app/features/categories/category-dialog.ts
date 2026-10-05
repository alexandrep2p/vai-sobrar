import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { Category } from '../../core/api/models';
import { CatalogService } from '../../core/data/catalog.service';
import { trimmedLength } from '../../shared/forms/validators';
import { categoryTypeLabel, type CategoryType } from '../../shared/labels/labels';

/** Criação e edição de categoria. `data` é a categoria editada (ausente na criação). */
@Component({
  selector: 'app-category-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInput,
    MatSelectModule,
    MatButton,
  ],
  template: `
    <h2 mat-dialog-title>{{ category ? 'Editar categoria' : 'Nova categoria' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        <mat-form-field class="full-width">
          <mat-label>Nome</mat-label>
          <input matInput formControlName="name" maxlength="100" autocomplete="off" />
          @if (form.controls.name.hasError('required')) {
            <mat-error>Informe o nome.</mat-error>
          }
        </mat-form-field>
        <mat-form-field class="full-width">
          <mat-label>Tipo</mat-label>
          <mat-select formControlName="type">
            @for (type of types; track type) {
              <mat-option [value]="type">{{ label(type) }}</mat-option>
            }
          </mat-select>
          @if (category?.in_use) {
            <mat-hint>O tipo não pode mudar enquanto a categoria estiver em uso.</mat-hint>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="submitting() || form.invalid">Salvar</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class CategoryDialog {
  protected readonly category = inject<Category | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly ref = inject(MatDialogRef<CategoryDialog, boolean>);
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
