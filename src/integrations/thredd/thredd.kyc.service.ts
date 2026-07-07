// KYC / Customer service.

import { isMockMode, threddFetch } from "./thredd.client";
import { threddMock } from "./thredd.mock";
import type { KycStatus, KycSubmission, ThreddCustomer } from "./thredd.types";

export const kycService = {
  createCustomer(input: { email: string; firstName: string; lastName: string }): Promise<ThreddCustomer> {
    if (isMockMode()) return threddMock.createCustomer(input);
    return threddFetch<ThreddCustomer>("/v1/customers", { method: "POST", body: JSON.stringify(input) });
  },
  submitKyc(input: KycSubmission): Promise<{ customerId: string; status: KycStatus }> {
    if (isMockMode()) return threddMock.submitKyc(input);
    return threddFetch(`/v1/customers/${input.customerId}/kyc`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  getKycStatus(customerId: string): Promise<{ customerId: string; status: KycStatus }> {
    if (isMockMode()) return threddMock.getKycStatus(customerId);
    return threddFetch(`/v1/customers/${customerId}/kyc`, { method: "GET" });
  },
};
