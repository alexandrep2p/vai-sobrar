import { TuiDay, TuiMonth } from '@taiga-ui/cdk';
import { IsoDateTransformer, IsoMonthTransformer, isoToMonth, monthToIso } from './iso-dates';

describe('datas ISO dos calendários', () => {
  it('data: texto AAAA-MM-DD ↔ TuiDay; vazio ou inválido vira null/""', () => {
    const t = new IsoDateTransformer();
    expect(t.fromControlValue('2027-01-08')?.toJSON()).toBe('2027-01-08');
    expect(t.fromControlValue('')).toBeNull();
    expect(t.fromControlValue('08/01/2027')).toBeNull();
    expect(t.toControlValue(new TuiDay(2027, 0, 8))).toBe('2027-01-08');
    expect(t.toControlValue(null)).toBe('');
  });

  it('mês: texto AAAA-MM ↔ TuiMonth (mês do TuiMonth começa em 0)', () => {
    const t = new IsoMonthTransformer();
    expect(t.fromControlValue('2027-01')?.month).toBe(0);
    expect(t.fromControlValue('')).toBeNull();
    expect(t.toControlValue(new TuiMonth(2027, 11))).toBe('2027-12');
    expect(monthToIso(isoToMonth('2026-10'))).toBe('2026-10');
  });
});
