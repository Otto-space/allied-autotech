import type { WorkshopResources } from "@/lib/admin/workshop-resource-settings";
import { capacityId, capacityRow } from "./work-booking-capacity";
export const resourceId = capacityId;
export const resourceSettings: WorkshopResources = {
  timezone: "Africa/Lagos",
  resources: [
    {
      id: resourceId(30),
      name: "Synthetic alignment machine",
      kind: "EQUIPMENT",
      pools: ["alignment"],
      status: "AVAILABLE",
      workingPeriods: [{ weekday: 1, opensAt: "08:00", closesAt: "18:00" }],
      unavailablePeriods: [],
    },
  ],
  technicians: [
    {
      staffId: resourceId(31),
      serviceIds: [resourceId(32)],
      workingPeriods: [{ weekday: 1, opensAt: "08:00", closesAt: "18:00" }],
      unavailablePeriods: [],
    },
  ],
  services: [
    { serviceId: resourceId(32), requirements: [{ pool: "alignment", quantity: 1 }] },
  ],
};
export const resourceRow = (version = 2, branchId = resourceId(1)) => ({
  ...capacityRow(version, branchId),
  key: `booking-resources:${branchId}`,
  sourceQuestion: "D06-D07",
  source: "Synthetic resource approval for disposable fixtures",
  approvalEvidence: "Synthetic resource evidence, not a real operating decision.",
  settings: structuredClone(resourceSettings),
});
