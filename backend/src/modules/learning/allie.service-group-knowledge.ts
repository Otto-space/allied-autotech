import { createHash } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client.js";
import type { AllieHistory, AllieKnowledge } from "./allie.contracts.js";
import { rankedPublicKnowledgeIds } from "./allie.knowledge-ranking.js";

export async function serviceGroupKnowledgeRevision(tx: Prisma.TransactionClient) {
  const [row] = await tx.$queryRaw<{ revision: string }[]>`
    SELECT encode(sha256(convert_to(COALESCE(string_agg(
      encode(sha256(convert_to(jsonb_build_array("id", "name", "description", "version", "updatedAt")::text, 'UTF8')), 'hex'), '' ORDER BY "id"), ''), 'UTF8')), 'hex') AS revision
    FROM "ServiceCategory" WHERE "isActive" = true
  `;
  return row!.revision;
}

export async function retrieveServiceGroupKnowledge(
  tx: Prisma.TransactionClient,
  terms: string[],
  refreshedAt: string,
  history?: AllieHistory,
): Promise<AllieKnowledge[]> {
  const previous = [
    ...new Set(
      (history?.turns ?? [])
        .slice(-6)
        .flatMap((turn) => turn.sourceIds.slice(0, 4))
        .flatMap((id) => {
          const match =
            /^service-group-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@v[1-9]\d*$/.exec(
              id,
            );
          return match ? [match[1]!] : [];
        }),
    ),
  ];
  const matches = await rankedPublicKnowledgeIds(tx, "service-group", terms);
  const ids = [...new Set([...previous, ...matches])];
  if (!ids.length) return [];
  const rows = await tx.serviceCategory.findMany({
    where: { isActive: true, id: { in: ids } },
    select: { id: true, name: true, description: true, version: true, updatedAt: true },
    take: 36,
  });
  return rows.flatMap((row) => {
    const summary = [
      row.description,
      "This is a published service group describing a broad area of workshop work, not an individual priced service. A group may have no individual services listed yet; that alone does not establish whether the work is available.",
      "No group price, appointment availability or booking confirmation is implied. Open the group and ask the workshop about your concern through the enquiry form.",
    ]
      .filter(Boolean)
      .join("\n");
    if (summary.length > 6000) return [];
    return [
      {
        id: "service-group-" + row.id,
        title: row.name,
        summary,
        prerequisites: "",
        steps: [],
        outcome: "",
        recovery:
          "Open the service group or contact the workshop for current information.",
        keywords: "service group workshop category enquiry",
        page: "other" as const,
        href: "/services?categoryId=" + row.id + "#service-catalogue",
        source: "ServiceCategory:" + row.id,
        version: row.version + 1,
        status: "published" as const,
        reviewedAt: row.updatedAt.toISOString(),
        permission: "public" as const,
        refreshedAt,
        contentHash: createHash("sha256")
          .update(JSON.stringify([row.name, summary]))
          .digest("hex"),
      },
    ];
  });
}
