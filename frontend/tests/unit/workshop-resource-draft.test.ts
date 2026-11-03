import { expect, it } from "vitest";
import {
  resourceDraftFromPlan,
  planFromResourceDraft,
  resourceInstant,
  resourceApprovalTime,
  lagosInput,
  emptyResourceDraft,
  resourceReviewFacts,
} from "@/lib/admin/workshop-resource-draft";
import { workshopResourceSettingsSchema } from "@/lib/admin/workshop-resource-settings";
import { resourceSettings, resourceId as id } from "../fixtures/workshop-resources";
const plan = () =>
  workshopResourceSettingsSchema.parse(structuredClone(resourceSettings));
it("starts without invented physical units, people, working hours or assessments", () => {
  expect(emptyResourceDraft()).toEqual({ resources: [], technicians: [], services: [] });
  expect(() => planFromResourceDraft(emptyResourceDraft())).toThrow();
});
it("round-trips a recorded plan and preserves physical identity with split periods and Nigeria dates", () => {
  const p = plan();
  p.resources[0]!.workingPeriods = [
    { weekday: 1, opensAt: "08:00", closesAt: "12:00" },
    { weekday: 1, opensAt: "13:00", closesAt: "18:00" },
  ];
  p.resources[0]!.unavailablePeriods = [
    {
      startsAt: "2030-05-01T09:00:00.000Z",
      endsAt: "2030-05-01T10:00:00.000Z",
      reason: "Synthetic maintenance",
    },
  ];
  const d = resourceDraftFromPlan(p);
  expect(d.resources[0]!.unavailablePeriods[0]!.startsAt).toBe("2030-05-01T10:00");
  expect(planFromResourceDraft(d)).toEqual(p);
  expect(lagosInput(resourceInstant("2030-05-01T08:00"))).toBe("2030-05-01T08:00");
});
it("requires an explicit no-resource assessment and does not infer one from an empty list", () => {
  const d = resourceDraftFromPlan(plan());
  d.services[0]!.requirements = [];
  expect(() => planFromResourceDraft(d)).toThrow(/Assess every service/);
  d.services[0]!.noResources = true;
  expect(planFromResourceDraft(d).services[0]!.requirements).toEqual([]);
  d.services[0]!.requirements = [{ pool: "alignment", quantity: 1 }];
  expect(() => planFromResourceDraft(d)).toThrow();
});
it("rejects unknown condition, missing qualifications, invalid dates, overlap and invalid resource categories", () => {
  for (const change of [
    (d: ReturnType<typeof resourceDraftFromPlan>) => {
      d.resources[0]!.status = "";
    },
    (d: ReturnType<typeof resourceDraftFromPlan>) => {
      d.resources[0]!.poolsText = "Alignment";
    },
    (d: ReturnType<typeof resourceDraftFromPlan>) => {
      d.technicians[0]!.serviceIds = [];
    },
    (d: ReturnType<typeof resourceDraftFromPlan>) => {
      d.resources[0]!.workingPeriods.push({
        weekday: 1,
        opensAt: "10:00",
        closesAt: "11:00",
      });
    },
    (d: ReturnType<typeof resourceDraftFromPlan>) => {
      d.resources[0]!.unavailablePeriods = [{ startsAt: "", endsAt: "", reason: "" }];
    },
  ]) {
    const d = resourceDraftFromPlan(plan());
    change(d);
    expect(() => planFromResourceDraft(d)).toThrow();
  }
});
it("keeps review facts meaningful without exposing raw internal references", () => {
  const facts = resourceReviewFacts(plan(), {
    [id(31)]: { id: id(31), label: "Synthetic specialist", eligible: true },
    [id(32)]: { id: id(32), label: "Synthetic alignment", eligible: true },
  });
  expect(JSON.stringify(facts)).toContain("Synthetic specialist");
  expect(JSON.stringify(facts)).toContain("1 × alignment");
  expect(JSON.stringify(facts)).not.toContain(id(31));
  expect(JSON.stringify(facts)).not.toContain(id(32));
  expect(JSON.stringify(facts)).toContain("Monday 08:00–18:00");
});

it("uses the freshly checked server time for immediate approval and validates future Nigeria times against that check", () => {
  const checked = "2030-05-01T07:00:00Z";
  expect(resourceApprovalTime("", checked)).toBe("2030-05-01T07:00:00.000Z");
  expect(resourceApprovalTime("2030-05-01T08:30", checked)).toBe(
    "2030-05-01T07:30:00.000Z",
  );
  expect(() => resourceApprovalTime("2030-05-01T08:00", checked)).toThrow();
  expect(() => resourceApprovalTime("", "bad-time")).toThrow();
});

it("preserves recorded unavailable-period seconds and milliseconds through unrelated edits", () => {
  const p = plan();
  p.resources[0]!.unavailablePeriods = [
    {
      startsAt: "2030-05-01T09:00:30.250Z",
      endsAt: "2030-05-01T10:00:45.125Z",
      reason: "Synthetic precise maintenance",
    },
  ];
  const draft = resourceDraftFromPlan(p);
  draft.resources[0]!.name = "Synthetic renamed machine";
  expect(planFromResourceDraft(draft).resources[0]!.unavailablePeriods).toEqual(
    p.resources[0]!.unavailablePeriods,
  );
});
