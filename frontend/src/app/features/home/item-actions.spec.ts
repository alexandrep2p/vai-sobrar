import {
  cardItem,
  installmentItem,
  projectedItem,
  recurrenceItem,
  refundCreditItem,
  statementItem,
} from '../../../testing/fixtures';
import { editableFields, itemActions, refundTargetKey } from './item-actions';

const granted = (item: Parameters<typeof itemActions>[0], open = true) => {
  const a = itemActions(item, open);
  return Object.entries(a)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .sort();
};

describe('itemActions — ações por origem e estado', () => {
  it('manual pendente: editar, pagar, apagar', () => {
    expect(granted(statementItem())).toEqual(['delete', 'edit', 'pay']);
  });

  it('manual pago: editar, desfazer, apagar', () => {
    expect(granted(statementItem({ status: 'PAID' }))).toEqual(['delete', 'edit', 'unpay']);
  });

  it('ocorrência gerada com método comum: editar, pagar e pular (somente pendente)', () => {
    expect(granted(recurrenceItem())).toEqual(['delete', 'edit', 'pay', 'skip']);
    expect(granted(recurrenceItem({ status: 'PAID' }))).toEqual(['delete', 'edit', 'unpay']);
  });

  it('ocorrência projetada: editar, pular e pagar (método comum)', () => {
    expect(granted(projectedItem())).toEqual(['edit', 'pay', 'skip']);
  });

  it('ocorrência projetada de cartão: sem pagar; liquidação pela fatura', () => {
    const item = projectedItem({
      credit_card: { id: 'c', name: 'Nubank' },
      payment_method: { id: 'p', name: 'Nubank' },
    });
    expect(granted(item)).toEqual(['edit', 'settledByInvoice', 'skip']);
  });

  it('compra à vista no cartão: editar, estornar, apagar; nunca pagar ou desfazer', () => {
    expect(granted(cardItem())).toEqual(['delete', 'edit', 'refund', 'settledByInvoice']);
  });

  it('parcela: editar (plano), estornar e apagar a compra parcelada inteira', () => {
    expect(granted(installmentItem())).toEqual(['delete', 'edit', 'refund', 'settledByInvoice']);
  });

  it('fatura paga: compra de cartão e parcela não são editadas nem apagadas, só estornadas', () => {
    const paid = {
      invoice: {
        id: 'i',
        reference_month: '2027-01',
        due_date: '2027-01-15',
        status: 'PAID' as const,
      },
    };
    expect(granted(cardItem(paid))).toEqual(['refund', 'settledByInvoice']);
    expect(granted(installmentItem(paid))).toEqual(['refund', 'settledByInvoice']);
  });

  it('ocorrência de cartão gerada: editar e estornar; sem pular nem pagar', () => {
    const item = recurrenceItem({
      credit_card: { id: 'c', name: 'Nubank' },
      invoice: { id: 'i', reference_month: '2027-01', due_date: '2027-01-15', status: 'OPEN' },
    });
    expect(granted(item)).toEqual(['delete', 'edit', 'refund', 'settledByInvoice']);
  });

  it('fatura paga: item de cartão deixa de ser editável, mas continua estornável', () => {
    const paid = cardItem({
      status: 'PAID',
      invoice: { id: 'i', reference_month: '2027-01', due_date: '2027-01-15', status: 'PAID' },
    });
    expect(granted(paid)).toEqual(['refund', 'settledByInvoice']);
    expect(granted(installmentItem({ invoice: paid.invoice }))).toEqual([
      'refund',
      'settledByInvoice',
    ]);
  });

  it('crédito de estorno não tem ações', () => {
    expect(granted(refundCreditItem())).toEqual([]);
  });

  it('mês fechado: nenhuma ação em nenhum item', () => {
    for (const item of [
      statementItem(),
      cardItem(),
      installmentItem(),
      recurrenceItem(),
      projectedItem(),
    ]) {
      expect(granted(item, false)).toEqual([]);
    }
  });
});

describe('editableFields — matriz de edição', () => {
  it('manual: todos os campos, método e categoria', () => {
    expect(editableFields(statementItem())).toEqual({
      description: true,
      amount: true,
      dueDate: true,
      category: true,
      method: true,
    });
  });

  it('ocorrência com método comum: sem categoria', () => {
    expect(editableFields(recurrenceItem())).toEqual({
      description: true,
      amount: true,
      dueDate: true,
      category: false,
      method: true,
    });
  });

  it('compra à vista no cartão: descrição e categoria apenas', () => {
    expect(editableFields(cardItem())).toEqual({
      description: true,
      amount: false,
      dueDate: false,
      category: true,
      method: false,
    });
  });

  it('parcela: descrição e categoria (do plano)', () => {
    const f = editableFields(installmentItem());
    expect(f.description && f.category).toBe(true);
    expect(f.amount || f.dueDate || f.method).toBe(false);
  });

  it('ocorrência de cartão: descrição e valor, sem data, método ou categoria', () => {
    const item = recurrenceItem({ credit_card: { id: 'c', name: 'N' } });
    expect(editableFields(item)).toEqual({
      description: true,
      amount: true,
      dueDate: false,
      category: false,
      method: false,
    });
  });
});

describe('refundTargetKey', () => {
  it('usa o plano para parcelas e o lançamento para compras à vista', () => {
    expect(refundTargetKey(installmentItem())).toBe('plan:plan1');
    expect(refundTargetKey(cardItem())).toBe('tx:t-card');
  });

  it('não há alvo para itens sem cartão, projetados ou créditos', () => {
    expect(refundTargetKey(statementItem())).toBeNull();
    expect(refundTargetKey(projectedItem())).toBeNull();
    expect(refundTargetKey(refundCreditItem())).toBeNull();
  });
});
