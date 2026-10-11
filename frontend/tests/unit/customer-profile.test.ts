import { describe, expect, it } from "vitest";
import {
  profileChanges,
  profileFormSchema,
  profileFormValues,
  parseProfile,
} from "@/lib/api/profile-schemas";
import { profileRecord } from "../fixtures/customer-profile";
describe("customer profile contract", () => {
  it("sends only changed fields and omits account and country fields", () => {
    const p = profileRecord();
    expect(profileChanges(p, { ...profileFormValues(p), firstName: "Ada" })).toEqual({
      firstName: "Ada",
    });
  });
  it("maps explicitly cleared optional values to null", () => {
    const p = profileRecord();
    expect(
      profileChanges(p, { ...profileFormValues(p), address: "", city: "", state: "" }),
    ).toEqual({ address: null, city: null, state: null });
  });
  it("does not submit an unchanged profile", () => {
    const p = profileRecord();
    expect(profileChanges(p, profileFormValues(p))).toEqual({});
  });
  it("treats missing optional values as blank form fields", () => {
    const p = profileRecord();
    p.address = null;
    expect(profileFormValues(p).address).toBe("");
  });
  it("trims submitted values and permits international names", () => {
    const v = profileFormSchema.parse({
      ...profileFormValues(profileRecord()),
      firstName: "  Chidiebere  ",
      lastName: "O'Connor",
    });
    expect(v.firstName).toBe("Chidiebere");
  });
  it("rejects invalid contact fields and control characters", () => {
    for (const change of [
      { firstName: "123" },
      { phone: "not-a-phone" },
      { address: "a\nb" },
      { city: "x\u0000y" },
    ])
      expect(
        profileFormSchema.safeParse({ ...profileFormValues(profileRecord()), ...change })
          .success,
      ).toBe(false);
  });
  it("rejects external private image URLs", () => {
    expect(() =>
      parseProfile({
        ...profileRecord(),
        photo: {
          id: "e7000000-0000-4000-8000-000000000007",
          url: "https://example.test/private.png",
          altText: null,
          sortOrder: 0,
          isPrimary: true,
          width: 80,
          height: 80,
        },
      }),
    ).toThrow();
  });
  it("does not conflate media revision with metadata concurrency", () => {
    const p = profileRecord();
    p.mediaVersion = 7;
    expect(profileChanges(p, { ...profileFormValues(p), phone: "08039999999" })).toEqual({
      phone: "08039999999",
    });
  });
});
