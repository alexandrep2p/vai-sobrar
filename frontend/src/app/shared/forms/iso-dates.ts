import { TuiDay, TuiMonth, TuiValueTransformer } from '@taiga-ui/cdk';
import { tuiInputDateOptionsProvider, tuiInputMonthOptionsProvider } from '@taiga-ui/kit';

/** `tuiInputDate` com controle em texto `AAAA-MM-DD` (formato da API); vazio = `''`. */
export class IsoDateTransformer extends TuiValueTransformer<TuiDay | null, string> {
  override fromControlValue(value: string): TuiDay | null {
    return /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? TuiDay.jsonParse(value) : null;
  }

  override toControlValue(day: TuiDay | null): string {
    return day ? day.toJSON() : '';
  }
}

/** `tuiInputMonth` com controle em texto `AAAA-MM`; vazio = `''`. */
export class IsoMonthTransformer extends TuiValueTransformer<TuiMonth | null, string> {
  override fromControlValue(value: string): TuiMonth | null {
    return /^\d{4}-\d{2}$/.test(value ?? '') ? isoToMonth(value) : null;
  }

  override toControlValue(month: TuiMonth | null): string {
    return month ? monthToIso(month) : '';
  }
}

export function isoToMonth(value: string): TuiMonth {
  const [year, month] = value.split('-').map(Number);
  return new TuiMonth(year, month - 1);
}

export function monthToIso(month: TuiMonth): string {
  return `${month.year}-${String(month.month + 1).padStart(2, '0')}`;
}

/**
 * Providers do componente que usa `tuiInputDate`/`tuiInputMonth`: o calendário do Taiga com o
 * valor do formulário em texto ISO, como antes com os inputs nativos.
 */
export const ISO_DATE_INPUTS = [
  tuiInputDateOptionsProvider({ valueTransformer: new IsoDateTransformer() }),
  tuiInputMonthOptionsProvider({ valueTransformer: new IsoMonthTransformer() }),
];
