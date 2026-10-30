// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  catalogueEnquiryContext,
  productEnquiryDraft,
  vehicleEnquiryDraft,
  vehicleEnquiryHref,
} from "@/lib/catalogue-enquiry";
import { partsEnquiryHref, productFitmentHref } from "@/lib/parts-fitment";
import { clearAccountDrafts, readDraft, writeDraft } from "@/lib/forms/drafts";
import {
  chooseEnquiryContext,
  enquiryDraftKey,
  prepareEnquiryContext,
  saveEnquiryDraftState,
} from "@/lib/forms/catalogue-enquiry-drafts";

const paramsOf = (href: string) =>
  new URL(href, "https://catalogue.invalid").searchParams;
it("carries public product budgets through its detail link without cursors or private context", () => {
  const input = new URLSearchParams({
    search: "engine oil",
    family: "ENGINE_OIL",
    minPriceKobo: "1000000",
    maxPriceKobo: "5000000",
    cursor: "private",
    vehicleId: "private",
    _trail: "private",
  });
  expect(
    Object.fromEntries(
      paramsOf(productFitmentHref("de000000-0000-4000-8000-000000000100", input)),
    ),
  ).toEqual({
    search: "engine oil",
    family: "ENGINE_OIL",
    minPriceKobo: "1000000",
    maxPriceKobo: "5000000",
  });
});
const oil = () =>
  catalogueEnquiryContext(
    paramsOf(
      partsEnquiryHref(
        new URLSearchParams({
          search: "engine oil",
          family: "ENGINE_OIL",
          oilViscosityGrade: "5W30",
          minPriceKobo: "1000000",
          maxPriceKobo: "5000000",
        }),
      ),
    ),
  );
const car = () =>
  catalogueEnquiryContext(
    paramsOf(
      vehicleEnquiryHref(
        new URLSearchParams({
          search: "Toyota Corolla",
          conditions: "FOREIGN_USED",
          maxPriceKobo: "1500000000",
        }),
      ),
    ),
  );
beforeEach(() => sessionStorage.clear());
describe("Public catalogue enquiry transfer", () => {
  it("carries both product budget limits with product wording and recorded oil grade", () => {
    const draft = productEnquiryDraft(paramsOf(oil().href));
    expect(draft.subject).toBe("Product enquiry: engine oil");
    expect(draft.message).toContain("5W-30");
    expect(draft.message).toMatch(/Minimum budget:.*10,000/);
    expect(draft.message).toMatch(/Maximum budget:.*50,000/);
    expect(draft.message).not.toContain("Vehicle: please add");
  });
  it("carries the Corolla, condition and NGN 15m preferences without claiming procurement", () => {
    const draft = vehicleEnquiryDraft(paramsOf(car().href));
    expect(draft.subject).toBe("Vehicle enquiry: Toyota Corolla");
    expect(draft.message).toContain("Foreign used");
    expect(draft.message).toContain("15,000,000");
    expect(draft.message).toContain("not a reservation");
  });
  it("canonicalises repeated contexts and preserves invalid listing intent for unavailable handling", () => {
    expect(
      catalogueEnquiryContext(
        new URLSearchParams("vehicle=1&vehicle_search=Toyota+Corolla"),
      ).id,
    ).toBe(
      catalogueEnquiryContext(
        new URLSearchParams("vehicle_search=Toyota+Corolla&vehicle=1"),
      ).id,
    );
    const context = catalogueEnquiryContext(
      new URLSearchParams("vehicle=1&vehicle_listingId=bad"),
    );
    expect(paramsOf(context.href).get("vehicle_listingId")).toBe("invalid");
  });
});
describe("Separate unsent catalogue drafts", () => {
  it("keeps both actual drafts through Start, resume, repeated navigation and Keep current", () => {
    const owner = "principal-a:CUSTOMER",
      a = oil(),
      b = car();
    const first = prepareEnquiryContext(owner, a);
    saveEnquiryDraftState(owner, first.state);
    writeDraft(enquiryDraftKey(owner, a), {
      "message:0": "My oil edits",
      "name:0": "Private A",
    });
    const incoming = prepareEnquiryContext(owner, b);
    expect(incoming.conflict).toBe(true);
    const started = chooseEnquiryContext(incoming.state, b.id, b.id);
    saveEnquiryDraftState(owner, started);
    writeDraft(enquiryDraftKey(owner, b), { "message:0": "My Corolla edits" });
    expect(prepareEnquiryContext(owner, b).selected.id).toBe(b.id);
    const kept = chooseEnquiryContext(started, b.id, a.id);
    saveEnquiryDraftState(owner, kept);
    const repeated = prepareEnquiryContext(owner, b);
    expect(repeated.conflict).toBe(false);
    expect(repeated.selected.id).toBe(a.id);
    expect(readDraft(enquiryDraftKey(owner, a))["message:0"]).toBe("My oil edits");
    expect(readDraft(enquiryDraftKey(owner, b))["message:0"]).toBe("My Corolla edits");
  });
  it("recovers an existing generic draft and never copies guest or another account's contact details", () => {
    const generic = catalogueEnquiryContext(new URLSearchParams());
    writeDraft(enquiryDraftKey("guest", generic), {
      "message:0": "Guest private work",
      "email:0": "private@example.test",
    });
    expect(prepareEnquiryContext("guest", car()).conflict).toBe(true);
    expect(prepareEnquiryContext("account-b:CUSTOMER", car()).conflict).toBe(false);
    expect(readDraft(enquiryDraftKey("account-b:CUSTOMER", generic))).toEqual({});
    const state = prepareEnquiryContext("guest", car());
    saveEnquiryDraftState("guest", state.state);
    clearAccountDrafts();
    expect(readDraft(enquiryDraftKey("guest", generic))).toEqual({});
    expect(Object.keys(sessionStorage)).toEqual([]);
  });
  it("reuses the established draft key when equivalent query parameters arrive in a different order", () => {
    const owner = "guest",
      a = oil();
    saveEnquiryDraftState(owner, prepareEnquiryContext(owner, a).state);
    writeDraft(enquiryDraftKey(owner, a), { "message:0": "Keep these edits" });
    const reversed = new URLSearchParams([...paramsOf(a.href)].reverse());
    const incoming = catalogueEnquiryContext(reversed);
    const next = prepareEnquiryContext(owner, incoming);
    expect(next.conflict).toBe(false);
    expect(next.selected.contextKey).toBe(a.contextKey);
    expect(readDraft(enquiryDraftKey(owner, next.selected))["message:0"]).toBe(
      "Keep these edits",
    );
  });
});

it("keeps service group enquiry identity without accepting client-supplied names or redirects", () => {
  const id = "de000000-0000-4000-8000-000000000100";
  const context = catalogueEnquiryContext(
    new URLSearchParams({
      serviceGroup: id,
      name: "Unverified name",
      redirect: "https://example.test",
    }),
  );
  expect(context.href).toBe("/contact?serviceGroup=" + id + "#enquiry");
  expect(context.contextKey).toBe("serviceGroup=" + id);
  expect(catalogueEnquiryContext(new URLSearchParams("serviceGroup=bad")).href).toBe(
    "/contact?serviceGroup=invalid#enquiry",
  );
  expect(
    catalogueEnquiryContext(
      new URLSearchParams("serviceGroup=" + id + "&serviceGroup=" + id),
    ).href,
  ).toBe("/contact?serviceGroup=invalid#enquiry");
});
