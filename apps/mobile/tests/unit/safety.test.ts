import { validateApiBaseUrl } from "../../src/api/client/environment";
import { asKoboString, parseKobo, formatNaira } from "../../src/money";
import {
  capabilitiesSchema,
  canCreateAccount,
  canSendEnquiry,
  canRequestBooking,
  canRequestInspection,
  canCheckout,
  canUseAllie,
} from "../../src/capabilities/model";

export const snapshotFixture = {
  scope: "POLICY_SUMMARY",
  serverTime: "2026-11-09T00:00:00.000Z",
  release: {
    mode: "browse_enquiries",
    customerAccountsEnabled: true,
    enquiriesEnabled: true,
    bookingRequestsEnabled: false,
    inspectionRequestsEnabled: false,
  },
  checkoutEnabled: false,
  collection: { enabled: true, address: "Synthetic test address" },
  delivery: { enabled: false },
  vehicleDeposits: { enabled: false },
  finance: { approvalStatus: null, draftVatBasisPoints: 750, pricesIncludeVat: false },
  booking: {
    confirmation: "STAFF_REVIEW",
    cancellationFeeKobo: "0",
    reminderMinutes: 60,
  },
  marketing: { enabled: false },
  destructiveRetention: { enabled: false },
};
describe("Environment guard: no request can start with unsafe configuration", () => {
  test.each([
    undefined,
    "",
    "not a URL",
    "https://local.invalid",
    "https://local.invalid/api/v1/",
    "https://user:secret@local.invalid/api/v1",
    "https://local.invalid/api/v1?secret=x",
  ])("refuses %s before network access", (value) =>
    expect(() => validateApiBaseUrl(value)).toThrow(),
  );
  test.each(["development", "test", "staging", "production"])(
    "blocks production in %s regardless of opt-in",
    (environment) => {
      process.env.EXPO_PUBLIC_APP_ENV = environment;
      process.env.EXPO_PUBLIC_ALLOW_PRODUCTION_API = "true";
      const network = jest.spyOn(global, "fetch");
      for (const host of [
        "api.alliedautotech.com",
        "API.ALLIEDAUTOTECH.COM.",
        "www.alliedautotech.com",
      ])
        expect(() => validateApiBaseUrl(`https://${host}/api/v1`)).toThrow(/blocked/);
      expect(network).not.toHaveBeenCalled();
      network.mockRestore();
      delete process.env.EXPO_PUBLIC_ALLOW_PRODUCTION_API;
      delete process.env.EXPO_PUBLIC_APP_ENV;
    },
  );
  test("accepts an explicitly configured local API", () =>
    expect(validateApiBaseUrl("http://127.0.0.1:4000/api/v1")).toBe(
      "http://127.0.0.1:4000/api/v1",
    ));
});
describe("MOB-022 capability groundwork", () => {
  const helpers = [
    canCreateAccount,
    canSendEnquiry,
    canRequestBooking,
    canRequestInspection,
    canCheckout,
    canUseAllie,
  ];
  test("unknown capabilities disable all six action helpers", () =>
    helpers.forEach((helper) => expect(helper(null)).toBe(false)));
  test.each([
    {},
    { ...snapshotFixture, scope: "OTHER" },
    { ...snapshotFixture, checkoutEnabled: true },
    { ...snapshotFixture, vehicleDeposits: { enabled: true } },
    { ...snapshotFixture, release: { ...snapshotFixture.release, mode: "catalogue" } },
    {
      ...snapshotFixture,
      release: { ...snapshotFixture.release, bookingRequestsEnabled: true },
    },
  ])("malformed or inconsistent snapshot fails closed", (value) => {
    const parsed = capabilitiesSchema.safeParse(value);
    expect(parsed.success).toBe(false);
    helpers.forEach((helper) =>
      expect(helper(parsed.success ? parsed.data : null)).toBe(false),
    );
  });
  test("valid server snapshot explicitly permits enquiries but never implies Allie", () => {
    const value = capabilitiesSchema.parse(snapshotFixture);
    expect(canSendEnquiry(value)).toBe(true);
    expect(canCheckout(value)).toBe(false);
    expect(canUseAllie(value)).toBe(false);
  });
});
describe("MOB-023 exact kobo display groundwork", () => {
  test("uses BigInt above Number's safe integer range and preserves stored digits", () => {
    const original = asKoboString("0009007199254740993123");
    expect(parseKobo(original)).toBe(9007199254740993123n);
    expect(formatNaira(original)).toBe("₦90,071,992,547,409,931.23");
    expect(original).toBe("0009007199254740993123");
    expect(formatNaira(asKoboString("0"))).toBe("₦0.00");
    expect(() => asKoboString(1 as unknown as string)).toThrow();
    expect(() => parseKobo("1\n")).toThrow();
  });
  test.each(["", "1.00", "-1", "+1", " 12", "1e3", "NaN"])("rejects %s", (value) =>
    expect(() => parseKobo(value)).toThrow(),
  );
});
