import {
  activeLabel,
  categoryTypeLabel,
  financialPeriodStatusLabel,
  invoiceStatusLabel,
  paymentMethodKindLabel,
  paymentMethodSourceLabel,
  recurrenceStatusLabel,
  refundStrategyLabel,
  transactionOriginLabel,
  transactionStatusLabel,
} from './labels';

describe('labels dos enums (domain-model §5)', () => {
  it('traduz cada enum', () => {
    expect(categoryTypeLabel('INCOME')).toBe('Entrada');
    expect(categoryTypeLabel('EXPENSE')).toBe('Saída');
    expect(paymentMethodSourceLabel('SYSTEM')).toBe('Sistema');
    expect(paymentMethodSourceLabel('USER')).toBe('Personalizado');
    expect(paymentMethodKindLabel('STANDARD')).toBe('Comum');
    expect(paymentMethodKindLabel('CREDIT_CARD')).toBe('Cartão de crédito');
    expect(transactionStatusLabel('PENDING')).toBe('Em aberto');
    expect(transactionStatusLabel('PAID')).toBe('Pago');
    expect(transactionOriginLabel('MANUAL')).toBe('Manual');
    expect(transactionOriginLabel('CREDIT_CARD')).toBe('Compra no cartão');
    expect(transactionOriginLabel('INSTALLMENT')).toBe('Parcela');
    expect(transactionOriginLabel('RECURRENCE')).toBe('Recorrência');
    expect(financialPeriodStatusLabel('OPEN')).toBe('Aberto');
    expect(financialPeriodStatusLabel('CLOSED')).toBe('Fechado');
    expect(invoiceStatusLabel('OPEN')).toBe('Aberta');
    expect(invoiceStatusLabel('CLOSED')).toBe('Fechada');
    expect(invoiceStatusLabel('PAID')).toBe('Paga');
    expect(recurrenceStatusLabel('ACTIVE')).toBe('Ativa');
    expect(recurrenceStatusLabel('PAUSED')).toBe('Pausada');
    expect(recurrenceStatusLabel('CANCELLED')).toBe('Cancelada');
    expect(refundStrategyLabel('FIRST_INSTALLMENTS')).toBe('Primeiras parcelas');
    expect(refundStrategyLabel('LAST_INSTALLMENTS')).toBe('Últimas parcelas');
    expect(refundStrategyLabel('PROPORTIONAL')).toBe('Proporcional');
  });

  it('traduz ativo/inativo no feminino e no masculino', () => {
    expect(activeLabel(true)).toBe('Ativa');
    expect(activeLabel(false)).toBe('Inativa');
    expect(activeLabel(true, 'm')).toBe('Ativo');
    expect(activeLabel(false, 'm')).toBe('Inativo');
  });
});
