/** Item de lista de escolha: o controle guarda o `id`, a tela mostra o `name`. */
export interface NamedOption {
  id: string;
  name: string;
}

/** `stringify` dos selects que guardam id: devolve o nome do item com aquele id (ou ''). */
export function nameById(items: () => readonly NamedOption[]): (id: string) => string {
  return (id) => items().find((item) => item.id === id)?.name ?? '';
}
