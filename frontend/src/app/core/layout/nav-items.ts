export interface NavItem {
  label: string;
  path: string;
  /** Ícone do Taiga UI (Lucide), no formato `@tui.<nome>`. */
  icon: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Home', path: '/home', icon: '@tui.house' },
  { label: 'Faturas', path: '/faturas', icon: '@tui.receipt' },
  { label: 'Recorrências', path: '/recorrencias', icon: '@tui.repeat' },
  { label: 'Categorias', path: '/categorias', icon: '@tui.tag' },
  { label: 'Métodos', path: '/metodos', icon: '@tui.wallet' },
  { label: 'Cartões', path: '/cartoes', icon: '@tui.credit-card' },
];
