import { Directive, ElementRef, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { centsToInput, formatMoneyInput, parseCents } from '../format/money';

/** Máximo de dígitos digitados: mantém o valor em centavos dentro de um inteiro seguro. */
const MAX_DIGITS = 12;

/**
 * Máscara monetária em tempo real (digitação da direita para a esquerda: 1 → 0,01 → 0,12 → 1,23).
 * O texto exibido é "1.234,56"; o valor do controle é "1234,56", aceito por `parseCents` e pelos
 * validators de `validators.ts`. Campo sem dígitos (ou só zeros) vira `''`.
 */
@Directive({
  selector: 'input[appMoneyInput]',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MoneyInput), multi: true },
  ],
  host: {
    inputmode: 'numeric',
    autocomplete: 'off',
    '(input)': 'onInput()',
    '(blur)': 'onTouched()',
  },
})
export class MoneyInput implements ControlValueAccessor {
  private readonly input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;

  private onChange: (value: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    const cents = value ? parseCents(String(value)) : null;
    this.input.value = cents === null ? '' : formatMoneyInput(cents);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.input.disabled = disabled;
  }

  protected onInput(): void {
    const digits = this.input.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITS);
    if (!digits) {
      this.input.value = '';
      this.onChange('');
      return;
    }
    const cents = Number(digits);
    this.input.value = formatMoneyInput(cents);
    this.onChange(centsToInput(cents));
  }
}
