import { TestBed } from '@angular/core/testing';
import { TuiDialogService } from '@taiga-ui/core';
import { EMPTY, of } from 'rxjs';
import { click, dialogProviders, dialogRef, one } from '../../../testing/helpers';
import { ConfirmDialog } from './confirm-dialog';
import { AppDialog } from './dialog';

describe('AppDialog', () => {
  function setup(result: unknown) {
    const open = vi.fn(() => result);
    TestBed.configureTestingModule({
      providers: [{ provide: TuiDialogService, useValue: { open } }],
    });
    return { dialog: TestBed.inject(AppDialog), open };
  }

  it('abre o componente com os dados e emite o valor de fechamento', () => {
    const { dialog, open } = setup(of(true));
    let result: unknown;
    dialog.open(ConfirmDialog, { title: 'x' }).subscribe((r) => (result = r));
    expect(open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ data: { title: 'x' }, size: 'm' }),
    );
    expect(result).toBe(true);
  });

  it('emite undefined quando o diálogo é dispensado', () => {
    const { dialog } = setup(EMPTY);
    const results: unknown[] = [];
    dialog.open(ConfirmDialog).subscribe((r) => results.push(r));
    expect(results).toEqual([undefined]);
  });
});

describe('ConfirmDialog', () => {
  const ref = dialogRef();

  function setup(destructive = false) {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: dialogProviders(
        { title: 'Apagar?', message: 'Não volta.', confirmLabel: 'Apagar', destructive },
        ref,
      ),
    });
    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.detectChanges();
    return fixture;
  }

  it('confirma com true e cancela com false', async () => {
    const fixture = setup();
    await click(fixture, one(fixture, '[data-testid="confirm"]'));
    expect(ref.close).toHaveBeenLastCalledWith(true);
    await click(fixture, one(fixture, 'button[appearance="flat"]'));
    expect(ref.close).toHaveBeenLastCalledWith(false);
  });

  it('destaca a confirmação de ação destrutiva', () => {
    const fixture = setup(true);
    expect(one(fixture, '[data-testid="confirm"]').getAttribute('data-appearance')).toBe(
      'primary-destructive',
    );
  });
});
