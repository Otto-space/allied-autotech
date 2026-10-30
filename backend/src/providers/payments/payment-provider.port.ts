export interface InitializePaymentCommand {
  email: string;
  customerName?: string;
  amountKobo: bigint;
  currency: "NGN";
  reference: string;
  callbackUrl?: string;
}

export interface InitializedPayment {
  authorizationUrl: string;
  accessCode: string;
  providerReference: string;
  authorizationExpiresAt: Date;
}

export interface VerifiedPayment {
  reference: string;
  gatewayTransactionId: string;
  status: "success" | "failed" | "abandoned" | "pending" | "reversed";
  amountKobo: bigint;
  currency: string;
  paidAt: Date | null;
  providerFeeKobo: bigint | null;
  method: string | null;
}

export interface InitiateRefundCommand {
  gatewayTransactionId: string;
  amountKobo: bigint;
  currency: "NGN";
  refundReference: string;
  reason: string;
  customerNote: string;
}

export interface InitiatedRefund {
  providerRefundId: string;
  status: string;
}

export interface VerifiedRefund {
  providerRefundId: string;
  status: "pending" | "succeeded" | "failed";
  amountKobo: bigint | null;
  currency: string | null;
}

export interface PaymentProviderPort {
  verifyDispute?(reference: string): Promise<VerifiedDispute>;
  initialize(command: InitializePaymentCommand): Promise<InitializedPayment>;
  verify(reference: string): Promise<VerifiedPayment>;
  refund(command: InitiateRefundCommand): Promise<InitiatedRefund>;
  verifyRefund?(reference: string): Promise<VerifiedRefund>;
}

export interface VerifiedDispute {
  providerDisputeId: string;
  reference: string;
  gatewayTransactionId: string;
  transactionAmountKobo: bigint;
  currency: string;
  providerStatus: string;
  resolution: string | null;
  refundAmountKobo: bigint | null;
  category: string | null;
  responseDueAt: Date | null;
  resolvedAt: Date | null;
  updatedAt: Date | null;
}
