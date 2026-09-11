import { providerUnavailable } from "../../common/errors/provider-error-mapper.js";
import { env } from "../../config/env.js";
import { monnifyProvider } from "./monnify.adapter.js";
import type { PaymentProviderPort } from "./payment-provider.port.js";
import { paystackProvider } from "./paystack.adapter.js";

export type OnlinePaymentProvider = "PAYSTACK" | "MONNIFY";

export class PaymentProviderRegistry {
  constructor(
    private readonly providers: Readonly<
      Partial<Record<OnlinePaymentProvider, PaymentProviderPort>>
    >,
  ) {}

  get(provider: OnlinePaymentProvider): PaymentProviderPort {
    const adapter = this.providers[provider];
    if (!adapter) throw providerUnavailable();
    return adapter;
  }

  enabledProviders(): OnlinePaymentProvider[] {
    const providers: OnlinePaymentProvider[] = [];
    if (env.PAYSTACK_MODE !== "disabled" && this.providers.PAYSTACK)
      providers.push("PAYSTACK");
    if (env.MONNIFY_MODE !== "disabled" && this.providers.MONNIFY)
      providers.push("MONNIFY");
    return providers;
  }
}

export const paymentProviders = new PaymentProviderRegistry({
  PAYSTACK: paystackProvider,
  MONNIFY: monnifyProvider,
});
