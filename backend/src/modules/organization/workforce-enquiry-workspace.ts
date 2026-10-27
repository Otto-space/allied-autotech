import {
  workforceCareContactSelect,
  projectWorkforceEnquiryContact,
} from "./workforce-care-contact.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { WorkforceSnapshot } from "./workforce.policy.js";
import { workforceNotFound, workforceSnapshot } from "./workforce.policy.js";
import { enquiryScope } from "./workforce-enquiry-scope.js";

export const workforceEnquirySelect = {
  id: true,
  branchId: true,
  subject: true,
  message: true,
  type: true,
  vehicleEnquiryIntent: true,
  status: true,
  version: true,
  assignedStaffId: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { id: true, name: true } },
  assignedStaff: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.EnquirySelect;

export function enquirySearchFilters(q?: string): Prisma.EnquiryWhereInput[] {
  return (q?.split(/\s+/).filter(Boolean) ?? []).map((term) => {
    const text = {
      contains: term.replace(/[\\%_]/g, "\\$&"),
      mode: "insensitive" as const,
    };
    return {
      OR: [
        { subject: text },
        { message: text },
        { messages: { some: { visibility: "CUSTOMER", body: text } } },
      ],
    };
  });
}

export async function latestEnquiryMessage(
  tx: Prisma.TransactionClient,
  enquiryId: string,
) {
  return tx.supportMessage.findFirst({
    where: { enquiryId, visibility: "CUSTOMER" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true },
  });
}

export async function readWorkforceEnquiry(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  access: WorkforceSnapshot,
  id: string,
  query: { limit: number; cursor?: string | undefined; messageId?: string | undefined },
) {
  const visible = await tx.enquiry.findFirst({
    where: { AND: [{ id }, enquiryScope(access)] },
    select: { id: true },
  });
  if (!visible) workforceNotFound();
  // Customer and staff message writers lock this parent row. Read the record,
  // latest-message precondition and history page from one consistent revision.
  await tx.$queryRaw`SELECT "id" FROM "Enquiry" WHERE "id" = ${id}::uuid FOR SHARE`;
  // Explicit access changes are serialised by the caller's workforce/actor locks,
  // but an assignment can naturally expire while this record lock is waiting.
  const current = await workforceSnapshot(tx, actor);
  const row = await tx.enquiry.findFirst({
    where: { AND: [{ id }, enquiryScope(current)] },
    select: {
      ...workforceEnquirySelect,
      ...(current.permissions.includes("CUSTOMER_ENQUIRIES")
        ? workforceCareContactSelect
        : {}),
    },
  });
  if (!row) workforceNotFound();
  const anchor = query.messageId ?? query.cursor;
  if (anchor) {
    const cursor = await tx.supportMessage.findFirst({
      where: { id: anchor, enquiryId: id, visibility: "CUSTOMER" },
      select: { id: true },
    });
    if (!cursor) workforceNotFound();
  }
  const latest = await latestEnquiryMessage(tx, id);
  const messages = await tx.supportMessage.findMany({
    where: { enquiryId: id, visibility: "CUSTOMER" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(anchor ? { cursor: { id: anchor }, skip: query.messageId ? 0 : 1 } : {}),
    select: {
      id: true,
      kind: true,
      fromStatus: true,
      toStatus: true,
      authorType: true,
      authorUserId: true,
      visibility: true,
      body: true,
      createdAt: true,
    },
  });
  const items = messages.slice(0, query.limit).map(({ authorUserId, ...message }) => ({
    ...message,
    isOwn: authorUserId === access.userId,
  }));
  const finalAccess = await workforceSnapshot(tx, actor);
  if (
    !(await tx.enquiry.findFirst({
      where: { AND: [{ id }, enquiryScope(finalAccess)] },
      select: { id: true },
    }))
  )
    workforceNotFound();
  return {
    ...projectWorkforceEnquiryContact(row, finalAccess),
    latestMessageId: latest?.id ?? null,
    messages: {
      items,
      ...(messages.length > query.limit ? { nextCursor: items.at(-1)!.id } : {}),
    },
    access: finalAccess,
    generatedAt: new Date().toISOString(),
  };
}
