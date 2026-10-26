const versionOne = {
  OPERATIONS: {
    label: "Operations Supervisor",
    department: "Strategy",
    scope: "BRANCH",
    actions: ["BOOKINGS_READ", "ORDERS_READ", "ORDERS_PREPARE", "FITMENT_AUTHOR"],
  },
  CUSTOMER_SERVICE: {
    label: "Customer Service Officer",
    department: "Customer Service",
    scope: "BRANCH",
    actions: ["BOOKINGS_READ", "CUSTOMER_ENQUIRIES", "COMPLAINTS", "ORDERS_READ"],
  },
  SALES_SUPERVISOR: {
    label: "Sales Supervisor",
    department: "Sales",
    scope: "BRANCH",
    actions: ["SALES_ENQUIRIES", "ENQUIRIES_ASSIGN", "ORDERS_READ", "FITMENT_AUTHOR"],
  },
  SALES_CASHIER: {
    label: "Sales Representative / Cashier",
    department: "Sales",
    scope: "ASSIGNED",
    actions: ["SALES_ENQUIRIES"],
  },
  ACCOUNTANT: {
    label: "Accountant",
    department: "Accounts",
    scope: "BRANCH",
    actions: ["FINANCE_READ"],
  },
  WORKSHOP_LEAD: {
    label: "Workshop / Quality Service Lead",
    department: "Services",
    scope: "BRANCH",
    actions: [
      "JOBS_READ",
      "JOBS_ASSIGN",
      "JOBS_UPDATE",
      "QUALITY_APPROVE",
      "FITMENT_REVIEW",
    ],
  },
  ELECTRICAL_TECHNICIAN: {
    label: "Electrical / Diagnostics Technician",
    department: "Services",
    scope: "ASSIGNED",
    actions: ["JOBS_READ", "JOBS_UPDATE"],
  },
  MECHANICAL_TECHNICIAN: {
    label: "Mechanical Technician",
    department: "Services",
    scope: "ASSIGNED",
    actions: ["JOBS_READ", "JOBS_UPDATE"],
  },
} as const;

// Version 1 includes the fitment authority already enforced by fitmentAccess before
// explicit capability projection. These names represent existing authority, not new grants.
// Never edit an applied version to expand access: add a new version and require review.
for (const definition of Object.values(versionOne)) {
  Object.freeze(definition.actions);
  Object.freeze(definition);
}
export const workforceTemplateVersions = Object.freeze({ 1: Object.freeze(versionOne) });
export const currentWorkforceTemplateVersion = 1;
export const workforceTemplates =
  workforceTemplateVersions[currentWorkforceTemplateVersion];
export type WorkforceAction =
  (typeof versionOne)[keyof typeof versionOne]["actions"][number];
export type WorkforceDefinition = {
  readonly label: string;
  readonly department: string;
  readonly scope: "BRANCH" | "ASSIGNED";
  readonly actions: readonly WorkforceAction[];
};
export function isKnownWorkforcePolicyVersion(version: number): boolean {
  return Number.isInteger(version) && Object.hasOwn(workforceTemplateVersions, version);
}
export function isSupportedDelegationTemplate(
  template: string,
  version: number,
): boolean {
  if (!isKnownWorkforcePolicyVersion(version)) return false;
  if (template === "ADMIN_INVITE") return true;
  const catalogue = (
    workforceTemplateVersions as Readonly<
      Record<number, Readonly<Record<string, WorkforceDefinition>>>
    >
  )[version];
  return !!catalogue && Object.hasOwn(catalogue, template);
}
export function definitionForAssignment(assignment: {
  template: string;
  templateVersion: number;
  scope: string;
}): WorkforceDefinition | undefined {
  if (!isKnownWorkforcePolicyVersion(assignment.templateVersion)) return;
  const catalogue = (
    workforceTemplateVersions as Readonly<
      Record<number, Readonly<Record<string, WorkforceDefinition>>>
    >
  )[assignment.templateVersion];
  if (!catalogue || !Object.hasOwn(catalogue, assignment.template)) return;
  const definition = catalogue[assignment.template];
  return definition?.scope === assignment.scope ? definition : undefined;
}
export function assignmentAllows(
  assignment: Parameters<typeof definitionForAssignment>[0],
  action: WorkforceAction,
): boolean {
  return definitionForAssignment(assignment)?.actions.includes(action) === true;
}
export function supportedAssignmentPolicies() {
  return Object.entries(workforceTemplateVersions).flatMap(([version, catalogue]) =>
    Object.entries(catalogue).map(([template, definition]) => ({
      template,
      templateVersion: Number(version),
      scope: definition.scope,
    })),
  );
}
