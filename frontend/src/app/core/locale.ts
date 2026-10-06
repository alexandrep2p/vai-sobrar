import { type Provider, signal } from '@angular/core';
import { TUI_DATE_FORMAT, type TuiDateFormatSettings } from '@taiga-ui/core';
import { TUI_DEFAULT_LANGUAGE, TUI_PORTUGUESE_LANGUAGE } from '@taiga-ui/i18n';

/** Calendários e textos do Taiga em português, com datas dd/mm/aaaa. */
export const LOCALE_PROVIDERS: Provider[] = [
  { provide: TUI_DEFAULT_LANGUAGE, useValue: TUI_PORTUGUESE_LANGUAGE },
  {
    provide: TUI_DATE_FORMAT,
    useValue: signal<TuiDateFormatSettings>({ mode: 'dd/mm/yyyy', separator: '/' }),
  },
];
