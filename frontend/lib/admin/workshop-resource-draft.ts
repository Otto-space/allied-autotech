import { z } from "zod";
import {
  workshopResourceSettingsSchema,
  type WorkshopResources,
} from "./workshop-resource-settings";
export const resourceDays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export type ResourceCalendar = {
  workingPeriods: { weekday: number; opensAt: string; closesAt: string }[];
  unavailablePeriods: { startsAt: string; endsAt: string; reason: string }[];
};
export type ResourceDraft = {
  resources: ({
    id: string;
    name: string;
    kind: "EQUIPMENT" | "SPACE";
    poolsText: string;
    status: "" | "AVAILABLE" | "UNAVAILABLE";
  } & ResourceCalendar)[];
  technicians: ({ staffId: string; serviceIds: string[] } & ResourceCalendar)[];
  services: {
    serviceId: string;
    noResources: boolean;
    requirements: { pool: string; quantity: number }[];
  }[];
};
export const emptyResourceDraft = (): ResourceDraft => ({
  resources: [],
  technicians: [],
  services: [],
});
export function lagosInput(iso: string) {
  const local = new Date(Date.parse(iso) + 3600000).toISOString().slice(0, -1);
  return local.endsWith(":00.000")
    ? local.slice(0, 16)
    : local.endsWith(".000")
      ? local.slice(0, 19)
      : local;
}
export function resourceInstant(local: string) {
  z.string()
    .regex(/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?$/)
    .parse(local);
  const value = (local.length === 16 ? local + ":00" : local) + "+01:00";
  z.iso.datetime({ offset: true }).parse(value);
  return new Date(value).toISOString();
}
export function resourceDraftFromPlan(plan: WorkshopResources): ResourceDraft {
  const calendar = (
    row:
      WorkshopResources["technicians"][number] | WorkshopResources["resources"][number],
  ) => ({
    workingPeriods: row.workingPeriods.map((p) => ({ ...p })),
    unavailablePeriods: row.unavailablePeriods.map((p) => ({
      ...p,
      startsAt: lagosInput(p.startsAt),
      endsAt: lagosInput(p.endsAt),
    })),
  });
  return {
    resources: plan.resources.map((r) => ({
      id: r.id.toLowerCase(),
      name: r.name,
      kind: r.kind,
      poolsText: r.pools.join(", "),
      status: r.status,
      ...calendar(r),
    })),
    technicians: plan.technicians.map((t) => ({
      staffId: t.staffId.toLowerCase(),
      serviceIds: t.serviceIds.map((id) => id.toLowerCase()),
      ...calendar(t),
    })),
    services: plan.services.map((s) => ({
      serviceId: s.serviceId.toLowerCase(),
      noResources: s.requirements.length === 0,
      requirements: s.requirements.map((r) => ({ ...r })),
    })),
  };
}
export function planFromResourceDraft(draft: ResourceDraft): WorkshopResources {
  if (
    draft.services.some(
      (s) =>
        (!s.noResources && !s.requirements.length) ||
        (s.noResources && s.requirements.length > 0),
    )
  )
    throw Error(
      "Assess every service: select required categories or explicitly confirm that no equipment or shared space is needed.",
    );
  const calendar = (r: ResourceCalendar) => ({
    workingPeriods: r.workingPeriods,
    unavailablePeriods: r.unavailablePeriods.map((p) => ({
      ...p,
      startsAt: resourceInstant(p.startsAt),
      endsAt: resourceInstant(p.endsAt),
    })),
  });
  return workshopResourceSettingsSchema.parse({
    timezone: "Africa/Lagos",
    resources: draft.resources.map(({ poolsText, ...r }) => ({
      ...r,
      pools: poolsText.trim() ? poolsText.split(",").map((v) => v.trim()) : [],
      ...calendar(r),
    })),
    technicians: draft.technicians.map((t) => ({ ...t, ...calendar(t) })),
    services: draft.services.map((s) => ({
      serviceId: s.serviceId,
      requirements: s.requirements,
    })),
  });
}
export const resourceOptionSchema = z.strictObject({
  id: z.uuid(),
  label: z.string().min(1),
  eligible: z.boolean(),
});
export type ResourceOption = z.infer<typeof resourceOptionSchema>;
export type ResourceKind = "SERVICE" | "TECHNICIAN";
export function parseResourceOptions(value: unknown, branch: string, kind: ResourceKind) {
  return z
    .strictObject({
      branchId: z.literal(branch),
      kind: z.literal(kind),
      items: z.array(resourceOptionSchema).max(100),
      nextCursor: z.uuid().nullable(),
    })
    .parse(value);
}
export function resourceReviewFacts(
  plan: WorkshopResources,
  labels: Record<string, ResourceOption>,
) {
  const name = (id: string) => labels[id]?.label ?? "Record no longer available";
  const calendar = (
    r: WorkshopResources["technicians"][number] | WorkshopResources["resources"][number],
  ) =>
    r.workingPeriods
      .map((p) => `${resourceDays[p.weekday]} ${p.opensAt}–${p.closesAt}`)
      .join("; ") +
    (r.unavailablePeriods.length
      ? ". Unavailable: " +
        r.unavailablePeriods
          .map(
            (p) =>
              `${lagosInput(p.startsAt).replace("T", " ")} to ${lagosInput(p.endsAt).replace("T", " ")}: ${p.reason}`,
          )
          .join("; ")
      : ". No unavailable periods recorded.");
  return [
    {
      label: "Equipment and shared spaces",
      value:
        plan.resources
          .map(
            (r) =>
              `${r.name} (${r.kind === "SPACE" ? "shared space" : "equipment"}): ${r.status === "AVAILABLE" ? "available" : "unavailable"}; categories ${r.pools.join(", ")}. ${calendar(r)}`,
          )
          .join("\n") || "None recorded",
    },
    {
      label: "Qualified technicians",
      value: plan.technicians
        .map(
          (t) =>
            `${name(t.staffId)} — ${t.serviceIds.map(name).join(", ")}. ${calendar(t)}`,
        )
        .join("\n"),
    },
    {
      label: "Service requirements",
      value: plan.services
        .map(
          (s) =>
            `${name(s.serviceId)}: ${s.requirements.length ? s.requirements.map((r) => `${r.quantity} × ${r.pool}`).join(", ") : "Assessed: no equipment or shared space required"}`,
        )
        .join("\n"),
    },
  ];
}

export function resourceApprovalTime(local: string, evaluatedAt: string) {
  const checked = z.iso.datetime({ offset: true }).parse(evaluatedAt);
  if (!local) return new Date(checked).toISOString();
  const candidate = resourceInstant(local);
  if (Date.parse(candidate) <= Date.parse(checked))
    throw Error("Choose an effective time after the latest server check.");
  return candidate;
}
