import { expect, it } from "vitest";
import { engineLitres, vehiclePresentation } from "@/lib/vehicle-presentation";
import { formatKobo } from "@/lib/format/money";
import { publicImageSrcSet, publicImageVariant } from "@/lib/public-image-variants";

it.each([
  [2000, "2.0 L"],
  [1998, "1.998 L"],
  [1490, "1.49 L"],
  [100, "0.1 L"],
  [0, undefined],
  [null, undefined],
])("shows %s cc without silently rounding", (cc, label) =>
  expect(engineLitres(cc as number | null)).toBe(label),
);
it("uses known data consistently and does not invent missing specifications", () => {
  expect(
    vehiclePresentation({
      year: 2007,
      make: "BMW",
      model: "120i",
      engineCapacityCc: 2000,
      doors: 5,
      bodyType: "HATCHBACK",
      cylinders: 4,
      engineCode: "N46",
    }),
  ).toEqual({
    title: "2007 BMW 120i",
    subtitle: "2.0 L · 5-door hatchback",
    specs: ["4 cylinders", "N46"],
  });
  expect(vehiclePresentation({ year: 2020, make: "Toyota", model: "Corolla" })).toEqual({
    title: "2020 Toyota Corolla",
    subtitle: "",
    specs: [],
  });
});
it("keeps catalogue money exact and transaction formatting unchanged", () => {
  expect(formatKobo("300000000", { hideZeroDecimals: true })).toBe("₦3,000,000");
  expect(formatKobo("300000001", { hideZeroDecimals: true })).toBe("₦3,000,000.01");
  expect(formatKobo("900719925474099199", { hideZeroDecimals: true })).toBe(
    "₦9,007,199,254,740,991.99",
  );
  expect(formatKobo("300000000")).toBe("₦3,000,000.00");
  expect(formatKobo(null, { hideZeroDecimals: true })).toBe("Request a quote");
});
const id = "f0000000-0000-4000-8000-000000000001";
it("offers bounded variants only for existing managed public image endpoints", () => {
  const src = `/api/v1/public/vehicles/images/${id}`;
  expect(publicImageVariant(src, 320)).toBe(
    `/api/catalogue-image/vehicles/images/${id}?w=320`,
  );
  expect(publicImageSrcSet(src, 480)).not.toContain("640w");
  expect(publicImageSrcSet(src, 100)).toBeUndefined();
  for (const unsafe of [
    `${src}?w=640`,
    `${src}/../private`,
    "https://evil.test/photo.webp",
    `/api/v1/staff/vehicles/${id}/images/${id}/content`,
    `/api/v1/public/vehicles/images/not-a-uuid`,
  ])
    expect(publicImageVariant(unsafe, 320)).toBeUndefined();
  expect(publicImageVariant(src, 99999)).toBeUndefined();
});
