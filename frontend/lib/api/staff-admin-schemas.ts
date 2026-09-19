import { z } from "zod";
import { staffProfileSchema } from "./staff-booking-schemas";
export const privilegedRoles = ["STAFF", "ADMIN", "SUPER_ADMIN"] as const;
export const staffStatuses = ["ACTIVE", "SUSPENDED", "DEACTIVATED"] as const;
const timestamp = z.iso.datetime({ offset: true });
export const staffMemberSchema = staffProfileSchema.extend({
  role: z.enum(privilegedRoles),
  status: z.enum(staffStatuses),
  emailVerifiedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
  staffProfile: z
    .object({
      id: z.uuid(),
      firstName: z.string(),
      lastName: z.string(),
      phone: z.string().nullable(),
      jobTitle: z.string().nullable(),
      branchId: z.uuid().nullable(),
      createdAt: timestamp,
      updatedAt: timestamp,
      branch: z
        .object({
          id: z.uuid(),
          code: z.string(),
          name: z.string(),
          isActive: z.boolean(),
        })
        .nullable(),
    })
    .nullable(),
});
export type StaffMember = z.infer<typeof staffMemberSchema>;
export const parseStaffMember = (value: unknown) => staffMemberSchema.parse(value);
export const parseStaffMembers = (value: unknown) =>
  z
    .object({ items: z.array(staffMemberSchema), nextCursor: z.uuid().optional() })
    .parse(value);
export const parseStaffStatus = (value: unknown) =>
  z.object({ id: z.uuid(), status: z.enum(staffStatuses) }).parse(value);
export const parseStaffBranch = (value: unknown) =>
  z.object({ id: z.uuid(), branchId: z.uuid() }).parse(value);
export const staffName = (member: StaffMember) =>
  member.staffProfile
    ? `${member.staffProfile.firstName} ${member.staffProfile.lastName}`
    : member.email;
export const staffRevision = (member: StaffMember) =>
  [
    member.updatedAt,
    member.role,
    member.status,
    member.staffProfile?.updatedAt,
    member.staffProfile?.branchId,
  ].join(":");
export function canManageStaff(actor: { id: string; role: string }, member: StaffMember) {
  return (
    actor.id !== member.id &&
    member.role !== "SUPER_ADMIN" &&
    (actor.role === "SUPER_ADMIN" || (actor.role === "ADMIN" && member.role === "STAFF"))
  );
}
