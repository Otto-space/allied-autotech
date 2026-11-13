// Synthetic contract fixtures for isolated tests only. Never imported by app code.
export const serviceId = "00000000-0000-4000-8000-000000000001";
export const otherServiceId = "00000000-0000-4000-8000-000000000002";
export const serviceFixture = {
  id: serviceId,
  name: "Synthetic contract fixture",
  description: "Synthetic full description returned by the API.",
  shortDescription: "Synthetic service summary.",
  pricingType: "FIXED" as const,
  priceKobo: "1250050",
  currency: "NGN" as const,
  durationMinutes: 60,
  isActive: true as const,
};
export function apiResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => ({
      success: status < 400,
      message: status === 404 ? "Service not found" : "Synthetic test response",
      data,
      meta: { requestId: "fixture-request" },
    }),
  } as unknown as Response;
}
