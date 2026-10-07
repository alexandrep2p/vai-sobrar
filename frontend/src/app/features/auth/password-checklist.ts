import { Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { passwordChecks, type PasswordChecks } from '../../shared/forms/auth-validators';

const RULES: readonly { key: keyof PasswordChecks; label: string }[] = [
  { key: 'length', label: 'Pelo menos 8 caracteres' },
  { key: 'letter', label: 'Uma letra (sem acento)' },
  { key: 'digit', label: 'Um número' },
  { key: 'special', label: 'Um caractere especial, como ! @ # $ % & * ? .' },
];

/** Requisitos da senha, atualizados a cada tecla (auth.md §4). */
@Component({
  selector: 'app-password-checklist',
  imports: [MatIcon],
  template: `
    <ul class="checklist" aria-live="polite" aria-label="Requisitos da senha">
      @for (rule of rules; track rule.key) {
        <li [class.met]="checks()[rule.key]" [attr.data-rule]="rule.key">
          <mat-icon aria-hidden="true">
            {{ checks()[rule.key] ? 'check_circle' : 'radio_button_unchecked' }}
          </mat-icon>
          <span>{{ rule.label }}</span>
          <span class="sr-only">{{ checks()[rule.key] ? '(atendido)' : '(pendente)' }}</span>
        </li>
      }
    </ul>
  `,
  styles: `
    .checklist {
      display: grid;
      gap: 0.25rem;
      margin: -0.25rem 0 1rem;
      padding: 0;
      list-style: none;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    li {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }
    li.met {
      color: var(--mat-sys-primary);
    }
    mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }
  `,
})
export class PasswordChecklist {
  readonly password = input('');
  protected readonly rules = RULES;
  protected readonly checks = computed(() => passwordChecks(this.password()));
}
