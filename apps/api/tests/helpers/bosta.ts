// Explicitly synthetic pricing evidence. Never used as merchant configuration.
export const BOSTA_RATE_CONTEXT = {
  accountId: "fixture-account",
  environment: "https://stg-app.bosta.co/api/v2",
  pricingContractId: "fixture-contract-v1",
  pickupCity: "Cairo",
  dropOffCity: "Cairo",
  destinationId: "district-1",
  size: "small" as const,
  providerSize: "Normal",
  serviceType: "delivery",
  paymentMethod: "prepaid" as const,
  codAmountCents: 0
};

export const BOSTA_RESPONSE_CONTRACT = {
  verified: true,
  evidence: "controlled test fixture; not account verification",
  currency: "EGP" as const,
  unit: "major" as const,
  amountPath: ["data", "price"],
  vatIncluded: true,
  feesIncluded: true
};
