import { z } from "zod";

// Business positions remain separate from task-specific responsibility templates.
export const workforcePositionLabels = {
  CEO_MD: "CEO / Managing Director",
  OPERATIONS: "Operations Supervisor",
  CUSTOMER_SERVICE: "Customer Service Officer",
  SALES_SUPERVISOR: "Sales Supervisor",
  SALES_CASHIER: "Sales Representative / Cashier",
  ACCOUNTANT: "Accountant",
  WORKSHOP_LEAD: "Workshop / Quality Service Lead",
  ELECTRICAL_TECHNICIAN: "Electrical / Diagnostics Technician",
  MECHANICAL_TECHNICIAN: "Mechanical Technician",
} as const;
export const workforcePositionSchema = z.enum(
  Object.keys(workforcePositionLabels) as [
    keyof typeof workforcePositionLabels,
    ...Array<keyof typeof workforcePositionLabels>,
  ],
);
// CEO is an existing owner position, not an enrolment/promotion option.
export const assignableWorkforcePositionSchema = workforcePositionSchema.exclude([
  "CEO_MD",
]);
