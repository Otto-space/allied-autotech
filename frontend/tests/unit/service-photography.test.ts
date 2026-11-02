import { describe, expect, it } from "vitest";
import { servicePhotograph } from "@/lib/service-photography";

describe("approved service photography", () => {
  it("uses genuine action photos for the two exact approved services", () => {
    for (const name of ["Comprehensive Vehicle Diagnostics", "Wheel Alignment"]) {
      const photo = servicePhotograph({ name, image: null });
      expect(photo?.url).toMatch(/\/workshop\/owner\/.*-at-work\.webp$/);
      expect(photo?.illustrative).toBe(false);
    }
  });
  it("labels the oil illustration without creating a Basic Oil package or generic diagnostics match", () => {
    expect(
      servicePhotograph({ name: "Generic Lube Oil Service", image: null }),
    ).toMatchObject({ illustrative: true, width: 800, height: 600 });
    for (const name of ["Basic Oil Service", "Quick Diagnostic Scan", "Unknown service"])
      expect(servicePhotograph({ name, image: null })).toBeNull();
  });
  it("honours managed authoring while reserving the landscape tyre photo for cards", () => {
    const image = {
      url: "/api/v1/public/media/images/fixture",
      altText: "Complete tyre changer",
      width: 768,
      height: 1024,
    };
    const tyre = { name: "Tyre Change", image };
    expect(servicePhotograph(tyre)).toBe(image);
    expect(servicePhotograph(tyre, "card")?.url).toContain("tyre-care-at-work");
    expect(servicePhotograph({ name: "Wheel Alignment", image })).toBe(image);
    expect(tyre.image).toBe(image);
  });
});
