import { FormControl, FormGroup } from '@angular/forms';
import {
  fullName,
  matchFields,
  normalizeName,
  passwordChecks,
  strongPassword,
  usernameFormat,
} from './auth-validators';

const err = (validator: (c: FormControl) => unknown, value: string) =>
  validator(new FormControl(value));

describe('validadores de conta (auth.md §4)', () => {
  it('passwordChecks avalia cada requisito', () => {
    expect(passwordChecks('')).toEqual({
      length: false,
      letter: false,
      digit: false,
      special: false,
    });
    expect(passwordChecks('abc123!@')).toEqual({
      length: true,
      letter: true,
      digit: true,
      special: true,
    });
    // acento e espaço não contam como letra nem especial
    expect(passwordChecks('é 1234567')).toMatchObject({ letter: false, special: false });
    expect(passwordChecks('a1`')).toMatchObject({ special: true });
  });

  it('strongPassword', () => {
    expect(err(strongPassword, '')).toEqual({ required: true });
    expect(err(strongPassword, 'abc123!@')).toBeNull();
    expect(err(strongPassword, 'abcd1234')).toEqual({
      password: { length: true, letter: true, digit: true, special: false },
    });
    expect(err(strongPassword, `a1!${'x'.repeat(126)}`)).toMatchObject({ maxlength: {} });
  });

  it('fullName exige 2 palavras e até 100 caracteres', () => {
    expect(err(fullName, '  ')).toEqual({ required: true });
    expect(err(fullName, 'Carlos')).toEqual({ fullName: true });
    expect(err(fullName, ' Carlos   Abreu ')).toBeNull();
    expect(err(fullName, `Carlos ${'a'.repeat(100)}`)).toMatchObject({ maxlength: {} });
    expect(normalizeName('  Carlos   de  Abreu ')).toBe('Carlos de Abreu');
  });

  it('usernameFormat', () => {
    expect(err(usernameFormat, '')).toEqual({ required: true });
    for (const ok of ['abc', 'Carlos.Abreu', 'a-b.C9', 'x'.repeat(30)]) {
      expect(err(usernameFormat, ok)).toBeNull();
    }
    for (const bad of ['ab', 'x'.repeat(31), 'carlos_abreu', 'joão', 'a b c']) {
      expect(err(usernameFormat, bad)).toEqual({ username: true });
    }
  });

  it('matchFields marca divergência no grupo', () => {
    const group = new FormGroup(
      { password: new FormControl('abc123!@'), confirm: new FormControl('') },
      { validators: matchFields('password', 'confirm') },
    );
    expect(group.hasError('mismatch')).toBe(false);
    group.controls.confirm.setValue('outra');
    expect(group.hasError('mismatch')).toBe(true);
    group.controls.confirm.setValue('abc123!@');
    expect(group.hasError('mismatch')).toBe(false);
  });
});
