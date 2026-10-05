import { ComponentFixture } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

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

/** Valor da linha de um resumo de confirmação aberto (overlay do diálogo). */
export function summaryRow(label: string): string | undefined {
  const rows = Array.from(document.querySelectorAll('[data-testid="summary"] .summary-row'));
  const row = rows.find((r) => r.querySelector('dt')?.textContent?.trim() === label);
  return row?.querySelector('dd')?.textContent?.trim();
}

/** Há resumo de confirmação aberto? */
export const summaryOpen = (): boolean => document.querySelector('[data-testid="summary"]') !== null;

/** Clica em "Confirmar" (true) ou "Voltar" (false) no resumo aberto; retorna se havia resumo. */
export async function answerSummary(
  fixture: ComponentFixture<unknown>,
  confirm: boolean,
): Promise<boolean> {
  const button = document.querySelector<HTMLButtonElement>(
    confirm ? '[data-testid="summary-confirm"]' : '[data-testid="summary-back"]',
  );
  if (!button) return false;
  button.click();
  // O fechamento do diálogo é animado: espera o resumo sair do DOM.
  await vi.waitFor(() => {
    fixture.detectChanges();
    expect(summaryOpen()).toBe(false);
  });
  await fixture.whenStable();
  return true;
}

export const dialogRefMock = () => ({ provide: MatDialogRef, useValue: { close: vi.fn() } });

export const ok = <T>(value: T) => of(value);
export const fail = (code = 'ERRO') => throwError(() => new Error(code));
