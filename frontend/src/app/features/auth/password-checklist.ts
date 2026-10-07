import { Component, computed, input } from '@angular/core';
import { TuiIcon } from '@taiga-ui/core';
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
  imports: [TuiIcon],
  template: `
    <ul class="checklist" aria-live="polite" aria-label="Requisitos da senha">
      @for (rule of rules; track rule.key) {
        <li [class.met]="checks()[rule.key]" [attr.data-rule]="rule.key">
          <tui-icon
            aria-hidden="true"
            [icon]="checks()[rule.key] ? '@tui.circle-check' : '@tui.circle'"
          />
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
      margin: -0.5rem 0 1rem;
      padding: 0;
      list-style: none;
      font: var(--tui-typography-body-s);
      color: var(--tui-text-secondary);
    }
    li {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }
    li.met {
      color: var(--tui-text-positive);
    }
    tui-icon {
      font-size: 1rem;
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
