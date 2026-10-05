import { describeInstallments } from './installments';

const nbsp = (s: string) => s.replace(/\s/g, ' ');

describe('describeInstallments', () => {
  it('parcelas iguais', () => {
    expect(nbsp(describeInstallments(59000, 10))).toBe('10x de R$ 59,00');
  });

  it('centavos restantes vão para as últimas parcelas', () => {
    expect(nbsp(describeInstallments(10000, 3))).toBe('2x de R$ 33,33 e 1x de R$ 33,34');
    expect(nbsp(describeInstallments(1000, 3))).toBe('2x de R$ 3,33 e 1x de R$ 3,34');
  });
});
