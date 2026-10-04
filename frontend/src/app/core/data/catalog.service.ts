import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient } from '../api/api-client';
import type { CardInput, Category, CreditCard, ListResponse, PaymentMethod } from '../api/models';
import type { CategoryType } from '../../shared/labels/labels';

/** Cadastros: categorias, métodos de pagamento e cartões. */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly api = inject(ApiClient);

  categories(): Observable<Category[]> {
    return this.api.get<ListResponse<Category>>('/categories').pipe(map((r) => r.data));
  }
  createCategory(body: { name: string; type: CategoryType }): Observable<Category> {
    return this.api.post('/categories', body);
  }
  updateCategory(id: string, body: { name?: string; type?: CategoryType }): Observable<Category> {
    return this.api.put(`/categories/${id}`, body);
  }
  setCategoryActive(id: string, active: boolean): Observable<Category> {
    return this.api.post(`/categories/${id}/${active ? 'activate' : 'deactivate'}`);
  }

  paymentMethods(): Observable<PaymentMethod[]> {
    return this.api.get<ListResponse<PaymentMethod>>('/payment-methods').pipe(map((r) => r.data));
  }
  createPaymentMethod(body: { name: string }): Observable<PaymentMethod> {
    return this.api.post('/payment-methods', body);
  }
  updatePaymentMethod(id: string, body: { name: string }): Observable<PaymentMethod> {
    return this.api.put(`/payment-methods/${id}`, body);
  }
  setPaymentMethodActive(id: string, active: boolean): Observable<PaymentMethod> {
    return this.api.post(`/payment-methods/${id}/${active ? 'activate' : 'deactivate'}`);
  }

  creditCards(): Observable<CreditCard[]> {
    return this.api.get<ListResponse<CreditCard>>('/credit-cards').pipe(map((r) => r.data));
  }
  createCreditCard(body: CardInput): Observable<CreditCard> {
    return this.api.post('/credit-cards', body);
  }
  updateCreditCard(id: string, body: Partial<CardInput>): Observable<CreditCard> {
    return this.api.put(`/credit-cards/${id}`, body);
  }
  setCreditCardActive(id: string, active: boolean): Observable<CreditCard> {
    return this.api.post(`/credit-cards/${id}/${active ? 'activate' : 'deactivate'}`);
  }
}
