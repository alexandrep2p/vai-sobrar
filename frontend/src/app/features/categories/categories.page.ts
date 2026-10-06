import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import type { Category } from '../../core/api/models';
import { CatalogService } from '../../core/data/catalog.service';
import { categoryTypeLabel, type CategoryType } from '../../shared/labels/labels';
import { AppDialog } from '../../shared/ui/dialog';
import { LoadState, type LoadStatus } from '../../shared/ui/load-state';
import { CategoryDialog } from './category-dialog';

interface Group {
  type: CategoryType;
  label: string;
  items: Category[];
}

const GROUP_LABELS: Record<CategoryType, string> = { INCOME: 'Entradas', EXPENSE: 'Saídas' };
const TYPES: CategoryType[] = ['INCOME', 'EXPENSE'];

@Component({
  selector: 'app-categories-page',
  imports: [MatButton, MatIconButton, MatIcon, LoadState],
  templateUrl: './categories.page.html',
})
export class CategoriesPage implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly dialog = inject(AppDialog);

  protected readonly status = signal<LoadStatus>('loading');
  protected readonly categories = signal<Category[]>([]);
  protected readonly sections = computed(() => [
    { title: 'Ativas', groups: this.group(true) },
    { title: 'Inativas', groups: this.group(false) },
  ]);
  protected readonly typeLabel = categoryTypeLabel;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.status.set('loading');
    this.catalog.categories().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }

  protected create(): void {
    this.open(null);
  }

  protected edit(category: Category): void {
    this.open(category);
  }

  protected toggle(category: Category): void {
    this.catalog.setCategoryActive(category.id, !category.active).subscribe(() => this.load());
  }

  private open(category: Category | null): void {
    this.dialog.open(CategoryDialog, category).subscribe((saved) => saved && this.load());
  }

  private group(active: boolean): Group[] {
    return TYPES.map((type) => ({
      type,
      label: GROUP_LABELS[type],
      items: this.categories().filter((c) => c.active === active && c.type === type),
    })).filter((group) => group.items.length > 0);
  }
}
