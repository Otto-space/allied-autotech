import { z } from "zod";

const label = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .refine(
    (value) =>
      [...value].every(
        (character) =>
          (character.codePointAt(0) ?? 0) > 31 && character.codePointAt(0) !== 127,
      ),
    "Use plain text",
  );
const pool = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[a-z][a-z0-9-]*$/, "Use a stable lower-case resource group");
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const minutes = (value: string) =>
  Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const weekly = z
  .strictObject({
    weekday: z.number().int().min(0).max(6),
    opensAt: clock,
    closesAt: clock,
  })
  .refine(
    (value) => minutes(value.opensAt) < minutes(value.closesAt),
    "A working period must end after it starts",
  );
const exception = z
  .strictObject({ startsAt: z.iso.datetime(), endsAt: z.iso.datetime(), reason: label })
  .refine(
    (value) => Date.parse(value.startsAt) < Date.parse(value.endsAt),
    "An unavailable period must end after it starts",
  );
const availability = {
  workingPeriods: z.array(weekly).min(1).max(28),
  unavailablePeriods: z.array(exception).max(100),
};
export const workshopResourceSettingsSchema = z
  .strictObject({
    timezone: z.literal("Africa/Lagos"),
    resources: z
      .array(
        z.strictObject({
          id: z.uuid(),
          name: label,
          kind: z.enum(["EQUIPMENT", "SPACE"]),
          pools: z.array(pool).min(1).max(10),
          status: z.enum(["AVAILABLE", "UNAVAILABLE"]),
          ...availability,
        }),
      )
      .max(100),
    technicians: z
      .array(
        z.strictObject({
          staffId: z.uuid(),
          serviceIds: z.array(z.uuid()).min(1).max(100),
          ...availability,
        }),
      )
      .min(1)
      .max(100),
    services: z
      .array(
        z.strictObject({
          serviceId: z.uuid(),
          requirements: z
            .array(z.strictObject({ pool, quantity: z.number().int().min(1).max(20) }))
            .max(10),
        }),
      )
      .min(1)
      .max(100),
  })
  .superRefine((value, ctx) => {
    const unique = (values: string[], path: (string | number)[]) => {
      if (new Set(values).size !== values.length)
        ctx.addIssue({ code: "custom", path, message: "Remove duplicate entries" });
    };
    unique(
      value.resources.map((row) => row.id),
      ["resources"],
    );
    unique(
      value.technicians.map((row) => row.staffId),
      ["technicians"],
    );
    unique(
      value.services.map((row) => row.serviceId),
      ["services"],
    );
    const services = new Set(value.services.map((row) => row.serviceId));
    const pools = new Set(value.resources.flatMap((row) => row.pools));
    for (const [i, row] of value.technicians.entries()) {
      unique(row.serviceIds, ["technicians", i, "serviceIds"]);
      if (row.serviceIds.some((id) => !services.has(id)))
        ctx.addIssue({
          code: "custom",
          path: ["technicians", i, "serviceIds"],
          message: "Review each selected service in this resource plan",
        });
    }
    for (const [i, row] of value.services.entries()) {
      unique(
        row.requirements.map((item) => item.pool),
        ["services", i, "requirements"],
      );
      if (row.requirements.reduce((sum, item) => sum + item.quantity, 0) > 40)
        ctx.addIssue({
          code: "custom",
          path: ["services", i, "requirements"],
          message: "Review at most 40 required resource units per service",
        });
      if (row.requirements.some((item) => !pools.has(item.pool)))
        ctx.addIssue({
          code: "custom",
          path: ["services", i, "requirements"],
          message: "Select a resource group present in this branch plan",
        });
      if (!value.technicians.some((item) => item.serviceIds.includes(row.serviceId)))
        ctx.addIssue({
          code: "custom",
          path: ["services", i, "serviceId"],
          message: "Select at least one eligible technician for each service",
        });
    }
    const calendars = [
      ...value.resources.map((row, i) => ({
        row,
        path: ["resources", i] as (string | number)[],
      })),
      ...value.technicians.map((row, i) => ({
        row,
        path: ["technicians", i] as (string | number)[],
      })),
    ];
    for (const { row, path } of calendars) {
      if ("pools" in row) unique(row.pools, [...path, "pools"]);
      for (let i = 0; i < row.workingPeriods.length; i++)
        for (let j = 0; j < i; j++) {
          const a = row.workingPeriods[i]!,
            b = row.workingPeriods[j]!;
          if (
            a.weekday === b.weekday &&
            minutes(a.opensAt) < minutes(b.closesAt) &&
            minutes(a.closesAt) > minutes(b.opensAt)
          )
            ctx.addIssue({
              code: "custom",
              path: [...path, "workingPeriods", i],
              message:
                "Working periods must not overlap; use separate periods around a break",
            });
        }
    }
  });
export type WorkshopResources = z.infer<typeof workshopResourceSettingsSchema>;
type Availability = {
  workingPeriods: WorkshopResources["technicians"][number]["workingPeriods"];
  unavailablePeriods: WorkshopResources["technicians"][number]["unavailablePeriods"];
};
export function resourceWindowAvailable(
  value: Availability,
  startsAt: Date,
  endsAt: Date,
) {
  const start = startsAt.getTime(),
    end = endsAt.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return false;
  const local = new Date(start + 3600000),
    day = local.toISOString().slice(0, 10);
  if (new Date(end + 3600000).toISOString().slice(0, 10) !== day) return false;
  let coveredUntil = start;
  const periods = value.workingPeriods
    .filter((row) => row.weekday === local.getUTCDay())
    .sort((a, b) => minutes(a.opensAt) - minutes(b.opensAt));
  for (const period of periods) {
    const opens = Date.parse(`${day}T${period.opensAt}:00+01:00`),
      closes = Date.parse(`${day}T${period.closesAt}:00+01:00`);
    if (closes <= coveredUntil) continue;
    if (opens > coveredUntil) break;
    coveredUntil = closes;
    if (coveredUntil >= end) break;
  }
  return (
    coveredUntil >= end &&
    !value.unavailablePeriods.some(
      (period) => Date.parse(period.startsAt) < end && Date.parse(period.endsAt) > start,
    )
  );
}
export type ResourceSelection =
  | { ok: true; resourceIds: string[] }
  | {
      ok: false;
      reason:
        | "SERVICE_UNASSESSED"
        | "TECHNICIAN_INELIGIBLE"
        | "TECHNICIAN_UNAVAILABLE"
        | "RESOURCE_UNAVAILABLE";
    };
/** Pure maximum matching. One physical unit can fill only one requirement, even if its groups overlap. */
export function selectWorkshopResources(
  plan: WorkshopResources,
  input: {
    serviceId: string;
    staffId: string;
    startsAt: Date;
    endsAt: Date;
    busyResourceIds: ReadonlySet<string>;
  },
): ResourceSelection {
  const service = plan.services.find((row) => row.serviceId === input.serviceId);
  if (!service) return { ok: false, reason: "SERVICE_UNASSESSED" };
  const technician = plan.technicians.find(
    (row) => row.staffId === input.staffId && row.serviceIds.includes(input.serviceId),
  );
  if (!technician) return { ok: false, reason: "TECHNICIAN_INELIGIBLE" };
  if (!resourceWindowAvailable(technician, input.startsAt, input.endsAt))
    return { ok: false, reason: "TECHNICIAN_UNAVAILABLE" };
  const units = plan.resources
    .filter(
      (row) =>
        row.status === "AVAILABLE" &&
        !input.busyResourceIds.has(row.id) &&
        resourceWindowAvailable(row, input.startsAt, input.endsAt),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  const needs = service.requirements.flatMap((row) =>
    Array.from({ length: row.quantity }, () => row.pool),
  );
  const assigned = new Map<string, number>();
  function match(index: number, seen: Set<string>): boolean {
    for (const unit of units) {
      if (!unit.pools.includes(needs[index]!) || seen.has(unit.id)) continue;
      seen.add(unit.id);
      const prior = assigned.get(unit.id);
      if (prior === undefined || match(prior, seen)) {
        assigned.set(unit.id, index);
        return true;
      }
    }
    return false;
  }
  for (let i = 0; i < needs.length; i++)
    if (!match(i, new Set())) return { ok: false, reason: "RESOURCE_UNAVAILABLE" };
  return { ok: true, resourceIds: [...assigned.keys()].sort() };
}
