import type { Prisma } from "../../generated/prisma/client.js";
import type { WorkforceSnapshot } from "./workforce.policy.js";
import { workforceNotFound } from "./workforce.policy.js";

export const workforceComplaintSelect = {
  id: true,
  branchId: true,
  subject: true,
  description: true,
  priority: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { id: true, name: true } },
} satisfies Prisma.ComplaintSelect;

export function complaintSearchFilters(q?: string): Prisma.ComplaintWhereInput[] {
  return (q?.split(/\s+/).filter(Boolean) ?? []).map((term) => {
    const text = {
      contains: term.replace(/[\\%_]/g, "\\$&"),
      mode: "insensitive" as const,
    };
    return {
      OR: [
        { subject: text },
        { description: text },
        { messages: { some: { visibility: "CUSTOMER", body: text } } },
      ],
    };
  });
}

export async function latestComplaintMessage(
  tx: Prisma.TransactionClient,
  complaintId: string,
) {
  return tx.supportMessage.findFirst({
    where: { complaintId, visibility: "CUSTOMER" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true },
  });
}

export async function readWorkforceComplaint(
  tx: Prisma.TransactionClient,
  access: WorkforceSnapshot,
  id: string,
  branchIds: string[],
  query: { limit: number; cursor?: string | undefined },
) {
  // Serialize the current revision and history with customer/legacy message writers.
  await tx.$queryRaw`SELECT "id" FROM "Complaint" WHERE "id" = ${id}::uuid FOR SHARE`;
  const row = await tx.complaint.findFirst({
    where: { id, branchId: { in: branchIds } },
    select: {
      ...workforceComplaintSelect,
      acknowledgedAt: true,
      acknowledgementDueAt: true,
      escalatedAt: true,
      resolution: true,
      resolvedAt: true,
      closedAt: true,
    },
  });
  if (!row) workforceNotFound();
  if (query.cursor) {
    const cursor = await tx.supportMessage.findFirst({
      where: { id: query.cursor, complaintId: id, visibility: "CUSTOMER" },
      select: { id: true },
    });
    if (!cursor) workforceNotFound();
  }
  const latest = await latestComplaintMessage(tx, id);
  const messages = await tx.supportMessage.findMany({
    where: { complaintId: id, visibility: "CUSTOMER" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
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
  return {
    ...row,
    latestMessageId: latest?.id ?? null,
    messages: {
      items,
      ...(messages.length > query.limit ? { nextCursor: items.at(-1)!.id } : {}),
    },
    access,
    generatedAt: new Date().toISOString(),
  };
}
