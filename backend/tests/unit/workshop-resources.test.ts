import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import {
  workshopResourceSettingsSchema,
  resourceWindowAvailable,
  selectWorkshopResources,
  type WorkshopResources,
} from "../../src/modules/service-operations/workshop-resources.js";
const serviceId = randomUUID(),
  staffId = randomUUID();
const periods = () =>
  Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    opensAt: "08:00",
    closesAt: "18:00",
  }));
const start = new Date("2040-01-02T09:00:00Z"),
  end = new Date("2040-01-02T10:00:00Z");
function plan(): WorkshopResources {
  return {
    timezone: "Africa/Lagos",
    resources: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Synthetic shared lift",
        kind: "SPACE",
        pools: ["lift", "alignment"],
        status: "AVAILABLE",
        workingPeriods: periods(),
        unavailablePeriods: [],
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        name: "Synthetic second lift",
        kind: "SPACE",
        pools: ["lift"],
        status: "AVAILABLE",
        workingPeriods: periods(),
        unavailablePeriods: [],
      },
    ],
    technicians: [
      {
        staffId,
        serviceIds: [serviceId],
        workingPeriods: periods(),
        unavailablePeriods: [],
      },
    ],
    services: [
      {
        serviceId,
        requirements: [
          { pool: "lift", quantity: 1 },
          { pool: "alignment", quantity: 1 },
        ],
      },
    ],
  };
}
function select(value = plan(), busyResourceIds: ReadonlySet<string> = new Set()) {
  return selectWorkshopResources(value, {
    serviceId,
    staffId,
    startsAt: start,
    endsAt: end,
    busyResourceIds,
  });
}
describe("explicit workshop resource configuration and matching", () => {
  it("finds a complete assignment when a greedy first choice would consume the only alignment unit", () => {
    const value = plan();
    expect(workshopResourceSettingsSchema.safeParse(value).success).toBe(true);
    expect(select(value)).toEqual({
      ok: true,
      resourceIds: value.resources.map((row) => row.id),
    });
  });
  it("never counts one physical unit twice across overlapping resource groups", () => {
    const value = plan();
    value.resources.pop();
    expect(select(value)).toEqual({ ok: false, reason: "RESOURCE_UNAVAILABLE" });
  });
  it("does not turn two machines into two eligible technicians", () => {
    const value = plan();
    expect(
      selectWorkshopResources(value, {
        serviceId,
        staffId: randomUUID(),
        startsAt: start,
        endsAt: end,
        busyResourceIds: new Set(),
      }),
    ).toEqual({ ok: false, reason: "TECHNICIAN_INELIGIBLE" });
  });
  it("excludes occupied units and restores a choice once a reservation no longer occupies the interval", () => {
    const value = plan();
    expect(select(value, new Set([value.resources[0]!.id]))).toEqual({
      ok: false,
      reason: "RESOURCE_UNAVAILABLE",
    });
    expect(select(value).ok).toBe(true);
  });
  it("excludes unavailable machines even when they exist in inventory", () => {
    const value = plan();
    value.resources[0]!.status = "UNAVAILABLE";
    expect(select(value)).toEqual({ ok: false, reason: "RESOURCE_UNAVAILABLE" });
  });
  it("requires an explicit reviewed service; an empty resource list is distinct from unknown requirements", () => {
    const value = plan();
    value.services = [];
    expect(select(value)).toEqual({ ok: false, reason: "SERVICE_UNASSESSED" });
    value.services = [{ serviceId, requirements: [] }];
    expect(select(value)).toEqual({ ok: true, resourceIds: [] });
  });
  it("checks the technician's entire occupied period and recorded absence", () => {
    const value = plan();
    value.technicians[0]!.unavailablePeriods = [
      {
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        reason: "Synthetic absence",
      },
    ];
    expect(select(value)).toEqual({ ok: false, reason: "TECHNICIAN_UNAVAILABLE" });
  });
  it("honours split shifts and breaks rather than only checking the start time", () => {
    const value = plan();
    value.resources[0]!.workingPeriods = [
      { weekday: start.getUTCDay(), opensAt: "08:00", closesAt: "10:30" },
      { weekday: start.getUTCDay(), opensAt: "11:00", closesAt: "18:00" },
    ];
    expect(select(value)).toEqual({ ok: false, reason: "RESOURCE_UNAVAILABLE" });
  });
  it("joins adjacent working periods without inventing a break", () => {
    const value = plan().technicians[0]!;
    value.workingPeriods = [
      { weekday: start.getUTCDay(), opensAt: "08:00", closesAt: "10:30" },
      { weekday: start.getUTCDay(), opensAt: "10:30", closesAt: "18:00" },
    ];
    expect(resourceWindowAvailable(value, start, end)).toBe(true);
  });
  it("accepts exact exception boundaries but rejects even one millisecond of overlap", () => {
    const value = plan().technicians[0]!;
    value.unavailablePeriods = [
      {
        startsAt: end.toISOString(),
        endsAt: new Date(end.getTime() + 60000).toISOString(),
        reason: "Synthetic break",
      },
    ];
    expect(resourceWindowAvailable(value, start, end)).toBe(true);
    expect(resourceWindowAvailable(value, start, new Date(end.getTime() + 1))).toBe(
      false,
    );
  });
  it("rejects invalid, zero and overnight occupied periods", () => {
    const value = plan().technicians[0]!;
    expect(resourceWindowAvailable(value, new Date(NaN), end)).toBe(false);
    expect(resourceWindowAvailable(value, start, start)).toBe(false);
    expect(
      resourceWindowAvailable(value, start, new Date(end.getTime() + 86400000)),
    ).toBe(false);
  });
  it("rejects duplicate physical units, services, technicians and service requirements", () => {
    for (const field of ["resources", "services", "technicians"] as const) {
      const value = plan();
      if (field === "resources") value.resources.push(value.resources[0]!);
      if (field === "services") value.services.push(value.services[0]!);
      if (field === "technicians") value.technicians.push(value.technicians[0]!);
      expect(workshopResourceSettingsSchema.safeParse(value).success).toBe(false);
    }
    const value = plan();
    value.services[0]!.requirements.push({ pool: "lift", quantity: 1 });
    expect(workshopResourceSettingsSchema.safeParse(value).success).toBe(false);
  });
  it("rejects overlapping shifts and unrecorded resource groups", () => {
    const value = plan();
    value.resources[0]!.workingPeriods.push(value.resources[0]!.workingPeriods[0]!);
    expect(workshopResourceSettingsSchema.safeParse(value).success).toBe(false);
    const unknown = plan();
    unknown.services[0]!.requirements = [{ pool: "not-recorded", quantity: 1 }];
    expect(workshopResourceSettingsSchema.safeParse(unknown).success).toBe(false);
  });
  it("rejects unreviewed or unstaffed services without guessing qualifications", () => {
    const value = plan();
    value.technicians[0]!.serviceIds = [randomUUID()];
    expect(workshopResourceSettingsSchema.safeParse(value).success).toBe(false);
  });
  it("bounds simultaneous resource demand and rejects negative or fractional quantities", () => {
    for (const quantity of [-1, 0, 1.5, 21]) {
      const value = plan();
      value.services[0]!.requirements[0]!.quantity = quantity;
      expect(workshopResourceSettingsSchema.safeParse(value).success).toBe(false);
    }
  });
});
