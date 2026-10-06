import { ComponentFixture } from '@angular/core/testing';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import { type Observable, of, Subject, throwError } from 'rxjs';
import { AppDialog } from '../app/shared/ui/dialog';
import { SummaryDialog, type SummaryData } from '../app/shared/ui/summary-dialog';

export const root = (fixture: ComponentFixture<unknown>): HTMLElement =>
  fixture.nativeElement as HTMLElement;

export const all = <T extends HTMLElement = HTMLElement>(
  fixture: ComponentFixture<unknown>,
  selector: string,
): T[] => Array.from(root(fixture).querySelectorAll<T>(selector));

export const one = <T extends HTMLElement = HTMLElement>(
  fixture: ComponentFixture<unknown>,
  selector: string,
): T => {
  const element = root(fixture).querySelector<T>(selector);
  if (!element) throw new Error(`Elemento não encontrado: ${selector}`);
  return element;
};

export async function click(
  fixture: ComponentFixture<unknown>,
  element: HTMLElement,
): Promise<void> {
  element.click();
  fixture.detectChanges();
  await fixture.whenStable();
}

export async function type(
  fixture: ComponentFixture<unknown>,
  element: HTMLInputElement,
  value: string,
): Promise<void> {
  element.value = value;
  element.dispatchEvent(new Event('input'));
  fixture.detectChanges();
  await fixture.whenStable();
}

/** Texto visível do componente, com espaços normalizados. */
export const text = (fixture: ComponentFixture<unknown>): string =>
  (root(fixture).textContent ?? '').replace(/\s+/g, ' ').trim();

/** Botão de confirmação (submit) do formulário do diálogo. */
export const submitButton = (fixture: ComponentFixture<unknown>): HTMLButtonElement =>
  one<HTMLButtonElement>(fixture, 'button[type="submit"]');

interface OpenDialog {
  component: unknown;
  data: unknown;
  result: Subject<unknown>;
}

/** Diálogos abertos pelo `AppDialog` falso do teste atual. */
let openDialogs: OpenDialog[] = [];

/**
 * `AppDialog` falso: registra cada diálogo aberto e devolve um resultado pendente. O resumo de
 * confirmação é respondido por `answerSummary`.
 */
export function appDialogStub() {
  openDialogs = [];
  return {
    open: vi.fn((component: unknown, data?: unknown): Observable<unknown> => {
      const result = new Subject<unknown>();
      openDialogs.push({ component, data, result });
      return result;
    }),
  };
}

/** Fechamento falso do diálogo: `close(valor)` e o dispensar (sem valor) chegam em `ref.close`. */
export const dialogRef = () => ({ close: vi.fn() });

/**
 * Providers para testar um componente aberto pelo `AppDialog`: os dados recebidos, o fechamento
 * observado em `ref.close` e um `AppDialog` falso para os diálogos que ele abrir.
 */
export function dialogProviders(data: unknown, ref = dialogRef()) {
  return [
    {
      provide: POLYMORPHEUS_CONTEXT,
      useValue: {
        data,
        completeWith: (value: unknown) => ref.close(value),
        $implicit: { complete: () => ref.close() },
      },
    },
    { provide: AppDialog, useValue: appDialogStub() },
  ];
}

const openSummary = (): OpenDialog | undefined =>
  [...openDialogs].reverse().find((d) => d.component === SummaryDialog);

/** Valor da linha do resumo de confirmação aberto. */
export function summaryRow(label: string): string | undefined {
  return (openSummary()?.data as SummaryData | undefined)?.rows.find((r) => r.label === label)
    ?.value;
}

/** Há resumo de confirmação aberto? */
export const summaryOpen = (): boolean => openSummary() !== undefined;

/** Responde "Confirmar" (true) ou "Voltar" (false) no resumo aberto; retorna se havia resumo. */
export async function answerSummary(
  fixture: ComponentFixture<unknown>,
  confirm: boolean,
): Promise<boolean> {
  const summary = openSummary();
  if (!summary) return false;
  openDialogs.splice(openDialogs.indexOf(summary), 1);
  summary.result.next(confirm);
  summary.result.complete();
  fixture.detectChanges();
  await fixture.whenStable();
  return true;
}

export const ok = <T>(value: T) => of(value);
export const fail = (code = 'ERRO') => throwError(() => new Error(code));
