import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../api/api-client';
import type {
  InstallmentPlan,
  InvoiceDetail,
  InvoiceSummary,
  ListResponse,
  MonthlyStatement,
  OccurrenceUpdate,
  Period,
  Recurrence,
  RecurrenceInput,
  RefundInput,
  RefundSummary,
  Transaction,
  TransactionInput,
  TransactionUpdate,
} from '../api/models';
import { map } from 'rxjs';

/** Extrato, lançamentos, faturas, estornos e recorrências. */
@Injectable({ providedIn: 'root' })
export class LedgerService {
  private readonly api = inject(ApiClient);

  statement(month: string): Observable<MonthlyStatement> {
    return this.api.get('/monthly-statement', { month });
  }
  closeMonth(month: string): Observable<Period> {
    return this.api.post(`/financial-periods/${month}/close`);
  }

  getTransaction(id: string): Observable<Transaction> {
    return this.api.get(`/transactions/${id}`);
  }
  /** Lançamento comum, compra à vista (resposta é o lançamento) ou parcelada (resposta tem o plano). */
  createTransaction(body: TransactionInput): Observable<unknown> {
    return this.api.post('/transactions', body);
  }
  updateTransaction(id: string, body: TransactionUpdate): Observable<Transaction> {
    return this.api.put(`/transactions/${id}`, body);
  }
  payTransaction(id: string, paidAt: string): Observable<Transaction> {
    return this.api.post(`/transactions/${id}/pay`, { paid_at: paidAt });
  }
  unpayTransaction(id: string): Observable<Transaction> {
    return this.api.post(`/transactions/${id}/unpay`);
  }
  deleteTransaction(id: string): Observable<void> {
    return this.api.delete(`/transactions/${id}`);
  }

  getPlan(id: string): Observable<InstallmentPlan> {
    return this.api.get(`/installment-plans/${id}`);
  }
  updatePlan(
    id: string,
    body: { description?: string; category_id?: string },
  ): Observable<unknown> {
    return this.api.put(`/installment-plans/${id}`, body);
  }

  invoices(cardId: string, from: string, to: string): Observable<InvoiceSummary[]> {
    return this.api
      .get<ListResponse<InvoiceSummary>>(`/credit-cards/${cardId}/invoices`, { from, to })
      .pipe(map((r) => r.data));
  }
  invoice(id: string): Observable<InvoiceDetail> {
    return this.api.get(`/invoices/${id}`);
  }
  payInvoice(
    id: string,
    body: { paid_at: string; payment_method_id: string },
  ): Observable<InvoiceDetail> {
    return this.api.post(`/invoices/${id}/pay`, body);
  }

  transactionRefunds(id: string): Observable<RefundSummary> {
    return this.api.get(`/transactions/${id}/refunds`);
  }
  planRefunds(id: string): Observable<RefundSummary> {
    return this.api.get(`/installment-plans/${id}/refunds`);
  }
  createRefund(body: RefundInput): Observable<unknown> {
    return this.api.post('/refunds', body);
  }

  recurrences(): Observable<Recurrence[]> {
    return this.api.get<ListResponse<Recurrence>>('/recurrences').pipe(map((r) => r.data));
  }
  createRecurrence(body: RecurrenceInput): Observable<Recurrence> {
    return this.api.post('/recurrences', body);
  }
  updateRecurrence(id: string, body: Partial<RecurrenceInput>): Observable<Recurrence> {
    return this.api.put(`/recurrences/${id}`, body);
  }
  pauseRecurrence(
    id: string,
    body: { paused_from: string; paused_until?: string },
  ): Observable<Recurrence> {
    return this.api.post(`/recurrences/${id}/pause`, body);
  }
  resumeRecurrence(id: string): Observable<Recurrence> {
    return this.api.post(`/recurrences/${id}/resume`);
  }
  cancelRecurrence(id: string): Observable<Recurrence> {
    return this.api.post(`/recurrences/${id}/cancel`);
  }

  editOccurrence(id: string, month: string, body: OccurrenceUpdate): Observable<unknown> {
    return this.api.put(`/recurrences/${id}/occurrences/${month}`, body);
  }
  payOccurrence(id: string, month: string, paidAt: string): Observable<unknown> {
    return this.api.post(`/recurrences/${id}/occurrences/${month}/pay`, { paid_at: paidAt });
  }
  skipOccurrence(id: string, month: string): Observable<unknown> {
    return this.api.post(`/recurrences/${id}/occurrences/${month}/skip`);
  }
}
