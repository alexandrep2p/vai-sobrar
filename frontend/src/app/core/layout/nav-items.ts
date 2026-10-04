export interface NavItem {
  label: string;
  path: string;
  /** Nome do ícone do Material Icons. */
  icon: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Home', path: '/home', icon: 'home' },
  { label: 'Faturas', path: '/faturas', icon: 'receipt_long' },
  { label: 'Recorrências', path: '/recorrencias', icon: 'event_repeat' },
  { label: 'Categorias', path: '/categorias', icon: 'sell' },
  { label: 'Métodos', path: '/metodos', icon: 'account_balance_wallet' },
  { label: 'Cartões', path: '/cartoes', icon: 'credit_card' },
];
