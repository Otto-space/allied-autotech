/** Fictional, deterministic sample catalogue. Isolated tests only; never bundled into public pages or written to a database. */
/** @param {number} n */
export const demoId = (n) => `de000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const demoBranch = {
  id: demoId(1),
  code: "DEMO",
  name: "DEMO workshop — not a real branch",
  city: "Port Harcourt",
  state: "Rivers",
};
export const demoCategories = [
  "Filters",
  "Brakes",
  "Engine components",
  "Oils and fluids",
  "Electrical",
].map((name, n) => ({
  id: demoId(10 + n),
  name: `DEMO ${name}`,
  slug: `demo-category-${n}`,
  description: "Synthetic catalogue group for local layout tests only.",
  parentId: null,
}));
export const demoMakes = ["Toyota", "Honda", "Nissan"].map((name, n) => ({
  id: demoId(20 + n),
  name,
}));
export const demoModels = [
  "Corolla",
  "Camry",
  "Civic",
  "Accord",
  "X-Trail",
  "Sentra",
].map((name, n) => ({
  id: demoId(30 + n),
  name,
  makeId: demoMakes[Math.floor(n / 2)].id,
  make: demoMakes[Math.floor(n / 2)],
  yearFrom: 2013,
  yearTo: 2025,
}));
const productNames = [
  "Air filter",
  "Front brake pads",
  "Spark plugs",
  "Engine oil",
  "Starter motor",
  "Oil filter",
  "Rear brake pads",
  "Drive belt",
  "Coolant",
  "Battery",
  "Cabin filter",
  "Brake disc",
  "Water pump",
  "Transmission fluid",
  "Alternator",
  "Fuel filter",
  "Brake hose",
  "Engine mount",
  "Brake fluid",
  "Headlamp assembly",
];
export const demoProducts = productNames.map((name, n) => ({
  id: demoId(100 + n),
  name: `DEMO ${name}${n === 19 ? " — extended replacement component name for narrow-screen layout verification" : ""}`,
  slug: `demo-product-${n}`,
  sku: `DEMO-${String(n + 1).padStart(3, "0")}`,
  brand: n % 4 ? "Demo manufacturer" : null,
  manufacturerPartNumber: n % 3 ? `DEMO-PART-${n + 1}` : null,
  description:
    "Fictional test product. Price and availability are illustrative and cannot be ordered.",
  priceKobo: String((n + 1) * 250050),
  compareAtPriceKobo: n % 4 === 0 ? String((n + 2) * 250050) : null,
  currency: "NGN",
  condition: n === 3 ? null : n % 5 === 0 ? "USED" : "NEW",
  classification: n === 3 ? null : "AFTERMARKET",
  productType: n === 3 ? "ENGINE_OIL" : n % 5 === 1 ? "BRAKE_PADS" : "TEST_COMPONENT",
  family: n === 3 ? "ENGINE_OIL" : n === 1 ? "REPLACEMENT_PART" : null,
  oilViscosityGrade: n === 3 ? "5W-30" : null,
  packVolumeMl: n === 3 ? 1000 : null,
  category: demoCategories[n % 5],
  images: [],
  compatibilities: [],
  availability: n % 4 === 0 ? [] : [{ branch: demoBranch, inStock: n % 3 !== 0 }],
}));
export const demoListings = Array.from({ length: 12 }, (_, n) => ({
  id: demoId(200 + n),
  title: `DEMO ${demoMakes[n % 3].name} ${demoModels[(n % 3) * 2].name} — illustrative listing ${n + 1}`,
  slug: `demo-vehicle-${n}`,
  priceKobo: String((n + 1) * 350000000),
  currency: "NGN",
  description: "Fictional vehicle for local tests. Not available for sale or inspection.",
  branch: demoBranch,
  vehicle: {
    id: demoId(220 + n),
    make: demoMakes[n % 3].name,
    model: demoModels[(n % 3) * 2].name,
    trim: null,
    year: 2014 + n,
    mileageKm: n === 0 ? 0 : n === 1 ? null : n * 12345,
    transmission: n % 2 ? "MANUAL" : "AUTOMATIC",
    fuelType: n % 3 ? "PETROL" : "HYBRID",
    condition: ["NEW", "FOREIGN_USED", "LOCALLY_USED", "USED"][n % 4],
    bodyType: n % 2 ? "SEDAN" : "SUV",
    color: null,
    images: [],
    conditionReports: [],
  },
}));
export const demoServices = [
  "Diagnostics",
  "Tyre change",
  "Brake inspection",
  "Maintenance enquiry",
].map((name, n) => ({
  id: demoId(300 + n),
  name: `DEMO ${name}`,
  slug: `demo-service-${n}`,
  description:
    "Illustrative service description for local testing. Confirm real service scope with the business.",
  shortDescription: null,
  pricingType: "QUOTE_REQUIRED",
  priceKobo: null,
  currency: "NGN",
  durationMinutes: null,
  version: 0,
}));
export const demoReviews = [3, 4, 5].map((rating, n) => ({
  id: demoId(400 + n),
  targetType: "BUSINESS",
  rating,
  title: "DEMO feedback — not a customer testimonial",
  comment: "Synthetic text for local review-carousel testing only.",
  createdAt: "2026-10-01T10:00:00Z",
  product: null,
  service: null,
}));
