// Synthetic records for isolated tests only.
export const id = (n: number) => `a9000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const branch = {
  id: id(10),
  code: "TEST",
  name: "Test branch",
  city: "Port Harcourt",
  state: "Rivers",
};
export const product = {
  id: id(1),
  name: "Synthetic part",
  slug: "synthetic-part",
  sku: "TEST-SEO",
  brand: null,
  manufacturerPartNumber: null,
  description: "Published part description for isolated verification.",
  priceKobo: "9007199254740993",
  compareAtPriceKobo: null,
  currency: "NGN",
  category: { id: id(11), name: "Test category", slug: "test", description: null },
  images: [],
  compatibilities: [],
  availability: [{ branch, inStock: true }],
};
export const service = {
  id: id(2),
  name: "Synthetic service",
  slug: "synthetic-service",
  description: "Published service description for isolated verification.",
  shortDescription: null,
  pricingType: "FIXED",
  priceKobo: "100000",
  currency: "NGN",
  durationMinutes: 60,
  version: 0,
};
export const listing = {
  id: id(3),
  title: "Synthetic vehicle",
  slug: "synthetic-vehicle",
  description: "Published vehicle description for isolated verification.",
  priceKobo: "5000000000",
  currency: "NGN",
  branch,
  vehicle: {
    id: id(12),
    make: "Test",
    model: "Model",
    trim: null,
    year: 2020,
    mileageKm: 100,
    transmission: "AUTOMATIC",
    fuelType: "PETROL",
    condition: "USED",
    bodyType: "SEDAN",
    color: null,
    images: [],
    conditionReports: [],
  },
};

export const policy = {
  version: "test-policy",
  minimumAdvanceHours: 72,
  maximumAdvanceHours: 720,
  paymentHoldMinutes: 30,
  depositBasisPoints: 3000,
  depositRefundableForCustomerCancellation: false,
  customerRescheduleLimit: 1,
  customerRescheduleCutoffHours: 24,
  reminderHoursBeforeAppointment: [24],
};
export const slot = {
  id: id(20),
  branchId: branch.id,
  serviceId: service.id,
  startsAt: "2027-10-01T10:00:00Z",
  endsAt: "2027-10-01T11:00:00Z",
  version: 0,
};
export const booking = {
  id: id(21),
  status: "AWAITING_DEPOSIT",
  version: 0,
  scheduledAt: slot.startsAt,
  service,
  branch,
  depositAmountKobo: "30000",
  depositPaidAt: null,
  paymentHoldExpiresAt: "2027-10-01T09:30:00Z",
  customerRescheduleCount: 0,
  disruptionRequestedAt: null,
  disruptionReason: null,
  disruptionResolution: null,
  depositPayment: null,
  quotes: [],
  workOrder: null,
};
export const quoteService = {
  ...service,
  id: id(40),
  name: "Synthetic quotation service",
  pricingType: "QUOTE_REQUIRED",
  priceKobo: null,
  durationMinutes: null,
};
export function publicRecord(path: string): unknown {
  if (path === `/public/services/${quoteService.id}`) return quoteService;
  if (path === `/public/catalog/products/${product.id}`) return product;
  if (path === `/public/services/${service.id}`) return service;
  if (path === `/public/vehicles/${listing.id}`) return listing;
  if (path === "/public/booking-policy") return policy;
  if (path === "/public/branches") return { items: [branch] };
  if (path === `/public/services/${service.id}/slots`) return { items: [slot] };
  return { items: [] };
}
