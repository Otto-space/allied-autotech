import { describe, expect, it } from "vitest";
import { koboToInput, nairaToKobo } from "../../lib/format/currency-input";
import { isPublicMediaUrl, publicMediaHosts } from "../../lib/media";

describe("exact currency input", () => {
  it.each([
    ["0.01", "1"],
    ["42.30", "4230"],
    ["9007199254740991.99", "900719925474099199"],
    ["001.2", "120"],
  ])("converts %s without floating point loss", (input, kobo) => {
    expect(nairaToKobo(input)).toBe(kobo);
    expect(nairaToKobo(koboToInput(kobo))).toBe(kobo);
  });
  it.each(["1e5", "1,000", "-1", "1.234", "Infinity", "", "1.2.3"])(
    "rejects ambiguous or invalid currency %s",
    (value) => expect(() => nairaToKobo(value)).toThrow(),
  );
});

describe("public media boundary", () => {
  it("accepts explicit hosts and rejects wildcard or policy injection", () => {
    expect(
      publicMediaHosts(
        " images.example.com, IMAGES.EXAMPLE.COM, *.example.com, https://example.com, evil.test; script-src * ",
      ),
    ).toEqual(["images.example.com"]);
  });
  it.each([
    "https://images.example.com.evil.test/image.jpg",
    "https://images.example.com:444/image.jpg",
    "https://user@images.example.com/image.jpg",
    "http://images.example.com/image.jpg",
    "/api/v1/public/vehicles/images/../../private/document",
  ])("rejects unsafe media URL %s", (src) =>
    expect(isPublicMediaUrl(src, ["images.example.com"])).toBe(false),
  );
  it("allows approved public media and the UUID image endpoint", () => {
    expect(
      isPublicMediaUrl("https://images.example.com/image.jpg", ["images.example.com"]),
    ).toBe(true);
    expect(
      isPublicMediaUrl(
        "/api/v1/public/vehicles/images/11111111-1111-4111-8111-111111111111",
        [],
      ),
    ).toBe(true);
  });
});
