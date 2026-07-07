// Card service — wraps the Thredd HTTP client with card-level operations.
// Falls back to an in-memory mock when THREDD_MOCK=true or no API key is set.

import { isMockMode, threddFetch } from "./thredd.http";
import { threddMock } from "./thredd.mock";
import type { ThreddCard, ThreddCardDetail, ThreddCardTxn } from "./thredd.types";

export const cardService = {
  createVirtualCard(input: { customerId: string; alias?: string; currency?: string }): Promise<ThreddCard> {
    if (isMockMode()) return threddMock.createVirtualCard(input);
    return threddFetch<ThreddCard>("/v1/cards/virtual", { method: "POST", body: JSON.stringify(input) });
  },
  createPhysicalCardRequest(input: {
    customerId: string;
    shippingAddress: string;
    alias?: string;
  }): Promise<ThreddCard> {
    if (isMockMode()) return threddMock.createPhysicalCardRequest(input);
    return threddFetch<ThreddCard>("/v1/cards/physical", { method: "POST", body: JSON.stringify(input) });
  },
  getCardList(customerId: string): Promise<ThreddCard[]> {
    if (isMockMode()) return threddMock.getCardList(customerId);
    return threddFetch<ThreddCard[]>("/v1/cards", { method: "GET", query: { customerId } });
  },
  getCardDetail(cardId: string): Promise<ThreddCardDetail> {
    if (isMockMode()) return threddMock.getCardDetail(cardId);
    return threddFetch<ThreddCardDetail>(`/v1/cards/${cardId}`, { method: "GET" });
  },
  freezeCard(cardId: string): Promise<ThreddCard> {
    if (isMockMode()) return threddMock.freezeCard(cardId);
    return threddFetch<ThreddCard>(`/v1/cards/${cardId}/freeze`, { method: "POST" });
  },
  unfreezeCard(cardId: string): Promise<ThreddCard> {
    if (isMockMode()) return threddMock.unfreezeCard(cardId);
    return threddFetch<ThreddCard>(`/v1/cards/${cardId}/unfreeze`, { method: "POST" });
  },
  getPin(cardId: string): Promise<{ pin: string }> {
    if (isMockMode()) return threddMock.getPin(cardId);
    return threddFetch<{ pin: string }>(`/v1/cards/${cardId}/pin`, { method: "GET" });
  },
  getCvv(cardId: string): Promise<{ cvv: string }> {
    if (isMockMode()) return threddMock.getCvv(cardId);
    return threddFetch<{ cvv: string }>(`/v1/cards/${cardId}/cvv`, { method: "GET" });
  },
  fundCard(cardId: string, amount: number, currency = "USD"): Promise<ThreddCard> {
    if (isMockMode()) return threddMock.fundCard(cardId, amount);
    return threddFetch<ThreddCard>(`/v1/cards/${cardId}/fund`, {
      method: "POST",
      body: JSON.stringify({ amount, currency }),
    });
  },
  getCardTransactions(cardId: string): Promise<ThreddCardTxn[]> {
    if (isMockMode()) return threddMock.getCardTransactions(cardId);
    return threddFetch<ThreddCardTxn[]>(`/v1/cards/${cardId}/transactions`, { method: "GET" });
  },
};
