interface PaymobBillingData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
}

export class PaymobProviderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PaymobProviderError";
  }
}

interface PaymobItem {
  name: string;
  amount: number;
  quantity: number;
}

export interface CreatePaymobIntentionInput {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  baseUrl: string;
  secretKey: string;
  publicKey: string;
  amountCents: number;
  integrationIds: number[];
  specialReference: string;
  expirationSeconds: number;
  notificationUrl?: string;
  redirectionUrl: string;
  billingData: PaymobBillingData;
  items: PaymobItem[];
}

export async function createPaymobIntention(input: CreatePaymobIntentionInput) {
  const signal = AbortSignal.timeout(input.timeoutMs ?? 10_000);
  let response: Response;
  try {
    response = await (input.fetchImpl ?? fetch)(`${input.baseUrl}/v1/intention/`, {
    method: "POST",
    signal,
    headers: {
      authorization: `Token ${input.secretKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      amount: input.amountCents,
      currency: "EGP",
      payment_methods: input.integrationIds,
      items: input.items,
      billing_data: input.billingData,
      special_reference: input.specialReference,
      expiration: input.expirationSeconds,
      ...(input.notificationUrl ? { notification_url: input.notificationUrl } : {}),
      redirection_url: input.redirectionUrl
    })
    });
  } catch (error) {
    if (signal.aborted) throw new PaymobProviderError("Paymob intention request timed out", { cause: error });
    throw new PaymobProviderError("Paymob intention request failed", { cause: error });
  }

  if (!response.ok) {
    throw new PaymobProviderError(`Paymob intention request failed with status ${response.status}`);
  }
  let body: Record<string, unknown>;
  try {
    body = await response.json() as Record<string, unknown>;
  } catch (error) {
    throw new PaymobProviderError("Paymob returned an invalid intention response", { cause: error });
  }
  if (
    typeof body.id !== "string" ||
    typeof body.intention_order_id !== "number" ||
    typeof body.client_secret !== "string"
  ) {
    throw new PaymobProviderError("Paymob returned an invalid intention response");
  }

  return {
    intentionId: body.id,
    orderId: body.intention_order_id,
    clientSecret: body.client_secret,
    checkoutUrl: `https://eg.checkout.paymob.com/?publicKey=${encodeURIComponent(input.publicKey)}&clientSecret=${encodeURIComponent(body.client_secret)}`
  };
}
