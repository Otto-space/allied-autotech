import type { Prisma } from "../../generated/prisma/client.js";
import { currentPolicy, policySnapshot } from "../policies/policies.service.js";
import { addBusinessMinutes, ownerSupportCalendar } from "./business-calendar.js";

export async function assignComplaintDeadline(tx: Prisma.TransactionClient, id: string) {
  const complaint = await tx.complaint.findUniqueOrThrow({ where: { id } });
  const policy = await currentPolicy(tx, "complaints");
  const settings = policy.settings as Record<string, unknown>;
  const holidays = Array.isArray(settings["holidays"])
    ? settings["holidays"].filter((value): value is string => typeof value === "string")
    : [];
  const urgent = complaint.priority === "URGENT";
  const definition = settings["ordinaryBusinessDayDefinition"];
  // Nonurgent due dates are withheld until the owner chooses the business-day definition.
  const minutes = urgent ? 60 : definition === "ACCUMULATED_WORKING_HOURS" ? 600 : null;
  const acknowledgementDueAt =
    minutes === null
      ? null
      : addBusinessMinutes(complaint.createdAt, minutes, {
          ...ownerSupportCalendar,
          holidays,
        });
  const snapshot = {
    ...policySnapshot(policy),
    holidayCalendarPending: settings["holidays"] === null,
    ordinaryDayDefinitionPending: definition === null,
  };
  await tx.complaint.update({
    where: { id },
    data: { acknowledgementDueAt, slaPolicySnapshot: snapshot },
  });
  if (minutes === null || settings["holidays"] === null)
    await tx.operationalAlert.upsert({
      where: { key: "complaint-calendar-approval" },
      update: {},
      create: {
        key: "complaint-calendar-approval",
        category: "POLICY_CONFIGURATION",
        message:
          "Complaint nonurgent business-day definition and holiday calendar require approval. Urgent targets use the signed Mon-Sat 08:00-18:00 Africa/Lagos schedule; holiday exceptions remain pending.",
      },
    });
  return { acknowledgementDueAt, acknowledgedAt: complaint.acknowledgedAt };
}
