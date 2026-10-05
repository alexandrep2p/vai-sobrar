import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MoneyInput } from './money-input';

@Component({
  imports: [ReactiveFormsModule, MoneyInput],
  template: `<input appMoneyInput [formControl]="control" />`,
})
class Host {
  readonly control = new FormControl('', { nonNullable: true });
}

function setup() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
  const type = (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event('input'));
  };
  return { fixture, input, control: fixture.componentInstance.control, type };
}

describe('MoneyInput', () => {
  it('preenche da direita para a esquerda', () => {
    const { input, control, type } = setup();
    type('1');
    expect([input.value, control.value]).toEqual(['0,01', '0,01']);
    type('0,012');
    expect([input.value, control.value]).toEqual(['0,12', '0,12']);
    type('0,123');
    expect([input.value, control.value]).toEqual(['1,23', '1,23']);
  });

  it('usa separador de milhar no campo e valor simples no controle', () => {
    const { input, control, type } = setup();
    type('123456');
    expect(input.value).toBe('1.234,56');
    expect(control.value).toBe('1234,56');
  });

  it('ignora caracteres que não são dígitos, inclusive ao colar', () => {
    const { input, control, type } = setup();
    type('R$ 1.234,56abc');
    expect([input.value, control.value]).toEqual(['1.234,56', '1234,56']);
  });

  it('apagar tudo (ou só zeros) deixa o controle vazio', () => {
    const { input, control, type } = setup();
    type('150');
    type('');
    expect([input.value, control.value]).toEqual(['', '']);
    type('000');
    expect([input.value, control.value]).toEqual(['', '']);
  });

  it('limita a quantidade de dígitos', () => {
    const { control, type } = setup();
    type('1'.repeat(20));
    expect(control.value).toBe('1111111111,11');
  });

  it('exibe o valor inicial com máscara', () => {
    const { fixture, input, control } = setup();
    control.setValue('1234,5');
    fixture.detectChanges();
    expect(input.value).toBe('1.234,50');
    control.setValue('');
    expect(input.value).toBe('');
  });

  it('marca como tocado ao sair do campo', () => {
    const { input, control } = setup();
    input.dispatchEvent(new Event('blur'));
    expect(control.touched).toBe(true);
  });
});
