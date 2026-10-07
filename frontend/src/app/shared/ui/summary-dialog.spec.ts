import { TestBed } from '@angular/core/testing';
import { all, dialogProviders, one, text } from '../../../testing/helpers';
import { SummaryDialog } from './summary-dialog';

describe('SummaryDialog', () => {
  it('lista os dados e oferece Voltar e Confirmar', () => {
    TestBed.configureTestingModule({
      providers: dialogProviders({
        title: 'Confirmar lançamento',
        confirmLabel: 'Confirmar',
        rows: [
          { label: 'Descrição', value: 'Luz' },
          { label: 'Valor', value: 'R$ 10,00' },
        ],
      }),
    });
    const fixture = TestBed.createComponent(SummaryDialog);
    fixture.detectChanges();
    expect(text(fixture)).toContain('Confirmar lançamento');
    expect(all(fixture, 'dt').map((e) => e.textContent?.trim())).toEqual(['Descrição', 'Valor']);
    expect(all(fixture, 'dd').map((e) => e.textContent?.trim())).toEqual(['Luz', 'R$ 10,00']);
    expect(one(fixture, '[data-testid="summary-back"]').textContent).toContain('Voltar');
    expect(one(fixture, '[data-testid="summary-confirm"]').textContent).toContain('Confirmar');
  });
});
