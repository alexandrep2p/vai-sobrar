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

export const dialogRefMock = () => ({ provide: MatDialogRef, useValue: { close: vi.fn() } });

export const ok = <T>(value: T) => of(value);
export const fail = (code = 'ERRO') => throwError(() => new Error(code));
