import type { WorkforceJobDetail } from "../../lib/admin/workforce-job-detail";
export const detailId = (n: number) =>
  `b8000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function jobDetailData(lead = false): WorkforceJobDetail {
  const stamp = "2026-10-19T09:40:00.000Z",
    actor = detailId(1),
    staff = detailId(2),
    branch = detailId(3);
  return {
    id: detailId(20),
    branchId: branch,
    branch: { id: branch, name: "Stadium Road" },
    scheduledAt: "2026-10-19T08:00:00.000Z",
    generatedAt: stamp,
    status: "IN_PROGRESS",
    version: 2,
    assignedStaffId: lead ? detailId(9) : staff,
    assignedStaff: {
      id: lead ? detailId(9) : staff,
      firstName: "Ada",
      lastName: "Okoro",
    },
    customerNotes: "Intermittent engine warning light and hesitation when accelerating.",
    service: { name: "Engine diagnostics" },
    vehicle: {
      make: "Toyota",
      model: "Corolla",
      year: 2020,
      registrationNumber: "PHC-101-AA",
    },
    workOrder: {
      id: detailId(21),
      workOrderNumber: "WO-2026-0124",
      status: "IN_PROGRESS",
      diagnosis:
        "Diagnostic scan completed. Inspect the ignition circuit before replacing parts.",
      internalNotes: "Check connectors and record the test readings.",
      version: 3,
      workedByUserIds: [lead ? detailId(10) : actor],
      qualityApprovedAt: null,
      qualityApprovedByUserId: null,
    },
    access: {
      managed: true,
      userId: actor,
      staffId: staff,
      position: lead ? "WORKSHOP_LEAD" : "ELECTRICAL_TECHNICIAN",
      department: "Services",
      version: 1,
      permissions: lead
        ? ["JOBS_READ", "JOBS_UPDATE", "JOBS_ASSIGN", "QUALITY_APPROVE"]
        : ["JOBS_READ", "JOBS_UPDATE"],
      canManageAssignments: false,
      canInviteAdmins: false,
      serverTime: stamp,
      assignments: [
        {
          id: detailId(4),
          userId: actor,
          branchId: branch,
          template: lead ? "WORKSHOP_LEAD" : "ELECTRICAL_TECHNICIAN",
          scope: lead ? "BRANCH" : "ASSIGNED",
          temporary: false,
          startsAt: stamp,
          expiresAt: null,
          reason: "Synthetic workshop responsibility",
          assignedByUserId: detailId(5),
          createdAt: stamp,
          revokedAt: null,
          revokedByUserId: null,
          revocationReason: null,
        },
      ],
    },
  };
}
