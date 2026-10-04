import { Routes } from '@angular/router';
import { ShellComponent } from './core/layout/shell';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        title: 'Home · Vai Sobrar',
        loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'faturas',
        title: 'Faturas · Vai Sobrar',
        loadComponent: () =>
          import('./features/invoices/invoices.page').then((m) => m.InvoicesPage),
      },
      {
        path: 'recorrencias',
        title: 'Recorrências · Vai Sobrar',
        loadComponent: () =>
          import('./features/recurrences/recurrences.page').then((m) => m.RecurrencesPage),
      },
      {
        path: 'categorias',
        title: 'Categorias · Vai Sobrar',
        loadComponent: () =>
          import('./features/categories/categories.page').then((m) => m.CategoriesPage),
      },
      {
        path: 'metodos',
        title: 'Métodos de pagamento · Vai Sobrar',
        loadComponent: () =>
          import('./features/payment-methods/payment-methods.page').then(
            (m) => m.PaymentMethodsPage,
          ),
      },
      {
        path: 'cartoes',
        title: 'Cartões · Vai Sobrar',
        loadComponent: () =>
          import('./features/credit-cards/credit-cards.page').then((m) => m.CreditCardsPage),
      },
      { path: '**', redirectTo: 'home' },
    ],
  },
];
