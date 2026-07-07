// Thredd API types (MVP subset)

export type CardType = "virtual" | "physical" | "travel";
export type CardStatus = "active" | "frozen" | "pending" | "closed";
export type KycStatus = "not_started" | "pending" | "approved" | "rejected";

export interface ThreddCustomer {
  customerId: string;
  email: string;
  firstName: string;
  lastName: string;
  kycStatus: KycStatus;
  createdAt: string;
}

export interface ThreddCard {
  cardId: string;
  customerId: string;
  type: CardType;
  status: CardStatus;
  last4: string;
  expiry: string; // MM/YY
  brand: "VISA" | "MASTERCARD";
  alias?: string;
  balance: number;
  currency: string;
  dailyLimit: number;
  createdAt: string;
}

export interface ThreddCardDetail extends ThreddCard {
  pan: string; // full number, only returned via getCardDetail
  cvv: string;
  pin: string;
}

export interface ThreddCardTxn {
  id: string;
  cardId: string;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  status: "authorized" | "cleared" | "declined" | "settled";
  timestamp: string;
}

export interface KycSubmission {
  customerId: string;
  documentType: "passport" | "id_card" | "driver_license";
  documentNumber: string;
  documentFrontUrl?: string;
  documentBackUrl?: string;
  selfieUrl?: string;
  addressLine1: string;
  city: string;
  country: string;
  postalCode: string;
  dateOfBirth: string;
}

// Webhook payloads
export type ThreddWebhookEvent =
  | { type: "card.created"; data: ThreddCard }
  | { type: "card.status_changed"; data: { cardId: string; status: CardStatus } }
  | { type: "authorization"; data: ThreddCardTxn }
  | { type: "clearing"; data: ThreddCardTxn }
  | { type: "settlement"; data: ThreddCardTxn }
  | { type: "kyc.status_changed"; data: { customerId: string; status: KycStatus } };

export interface ThreddApiError {
  code: string;
  message: string;
  details?: unknown;
}
