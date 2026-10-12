// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { profileRecord } from "../fixtures/customer-profile";
import { profileFormValues } from "@/lib/api/profile-schemas";
import { setDraftIdentity, writeDraft } from "@/lib/forms/drafts";
import {
  readProfileDraft,
  saveProfileDraft,
  profileDraftKey,
  rebaseProfileDraft,
} from "@/lib/forms/profile-draft";

describe("profile draft revision binding", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setDraftIdentity(`${profileRecord().user.id}:CUSTOMER`);
  });
  it("restores the original baseline and revision after a newer server read", () => {
    const p = profileRecord();
    const baseline = profileFormValues(p);
    saveProfileDraft(
      p,
      { version: 0, baseline, recovery: false },
      { ...baseline, firstName: "Draft" },
    );
    const restored = readProfileDraft({
      ...p,
      profileVersion: 1,
      firstName: "New server value",
    });
    expect(restored.context).toEqual({ version: 0, baseline, recovery: false });
    expect(restored.values.firstName).toBe("Draft");
  });
  it("retains the unknown outcome across reloads", () => {
    const p = profileRecord();
    saveProfileDraft(
      p,
      { version: 0, baseline: profileFormValues(p), recovery: true },
      profileFormValues(p),
    );
    expect(readProfileDraft(p).context.recovery).toBe(true);
  });
  it("requires explicit review for legacy and damaged context without deleting entered values", () => {
    const p = profileRecord();
    for (const context of [undefined, "broken", JSON.stringify({ version: -1 })]) {
      writeDraft(profileDraftKey(p)!, {
        "firstName:0": "Legacy",
        ...(context ? { "@profile": context } : {}),
      });
      const draft = readProfileDraft(p);
      expect(draft.context.recovery).toBe(true);
      expect(draft.values.firstName).toBe("Legacy");
    }
  });
  it("rebases only edited fields and retains unrelated server edits", () => {
    const p = profileRecord(),
      baseline = profileFormValues(p);
    const values = { ...baseline, firstName: "Ada", address: "" };
    const saved = { ...p, profileVersion: 2, city: "Abuja" };
    expect(
      rebaseProfileDraft({ version: 0, baseline, recovery: false }, values, saved),
    ).toEqual({ ...baseline, firstName: "Ada", address: "", city: "Abuja" });
  });
  it("cannot read or write a profile draft under another account or role", () => {
    const p = profileRecord(),
      baseline = profileFormValues(p);
    saveProfileDraft(
      p,
      { version: 0, baseline, recovery: false },
      { ...baseline, firstName: "Private" },
    );
    setDraftIdentity("another:CUSTOMER");
    expect(profileDraftKey(p)).toBeNull();
    expect(readProfileDraft(p).values.firstName).toBe(p.firstName);
    setDraftIdentity(`${p.user.id}:ADMIN`);
    expect(profileDraftKey(p)).toBeNull();
  });
});
