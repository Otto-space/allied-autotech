import type { StaffInspection } from "@/lib/api/staff-inspection-schemas";
export const inspectionId = (value: number) =>
  `90000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
export function inspectionFixture(): StaffInspection {
  return {
    id: inspectionId(1),
    customerName: "Isolated inspector customer",
    assignedStaffId: null,
    status: "REQUESTED",
    version: 2,
    preferredStartAt: "2026-10-20T09:00:00Z",
    preferredEndAt: null,
    scheduledStartAt: null,
    scheduledEndAt: null,
    notes: "Isolated customer request",
    cancellationReason: null,
    confirmedAt: null,
    completedAt: null,
    cancelledAt: null,
    vehicleListing: {
      id: inspectionId(2),
      title: "Isolated inspection vehicle",
      status: "AVAILABLE",
      branchId: inspectionId(3),
      vehicle: {
        make: "Isolated",
        model: "Vehicle",
        year: 2024,
        stockNumber: "ISOLATED-INSPECTION-001",
      },
    },
    assignedStaff: null,
    conditionReport: null,
  };
}
