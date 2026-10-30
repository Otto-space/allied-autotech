import { rankedPublicKnowledgeIds } from "./allie.knowledge-ranking.js";
import { createHash } from "node:crypto";
import {
  catalogueKnowledgeRevision,
  retrieveCatalogueKnowledge,
} from "./allie.catalogue-knowledge.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { serviceSelect } from "../service-operations/service-operations.repository.js";
import type { AllieHistory, AllieKnowledge } from "./allie.contracts.js";

// Canonical public service fields only. Publication changes and even edits without
// a version bump invalidate stored answers. No prices or prose leave this query.
export async function publicKnowledgeRevision(tx: Prisma.TransactionClient) {
  const [row] = await tx.$queryRaw<{ revision: string }[]>`
    SELECT encode(sha256(convert_to(COALESCE(string_agg(
      encode(sha256(convert_to(jsonb_build_array(
        "id", "name", "description", "shortDescription", "pricingType",
        "priceKobo"::text, "currency", "durationMinutes", "version", "updatedAt"
      )::text, 'UTF8')), 'hex'), '' ORDER BY "id"), ''), 'UTF8')), 'hex') AS revision
    FROM "Service" WHERE "isActive" = true
  `;
  return createHash("sha256")
    .update(
      JSON.stringify([
        "public-knowledge-v3",
        row!.revision,
        await catalogueKnowledgeRevision(tx),
      ]),
    )
    .digest("hex");
}

const identity =
  /^service-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@v[1-9]\d*$/;
export function publicServiceSource(
  row: Prisma.ServiceGetPayload<{ select: typeof serviceSelect }>,
  refreshedAt: string,
): AllieKnowledge | null {
  if (!row.isActive) return null;
  const money =
    row.priceKobo === null
      ? null
      : `${row.currency} ${row.priceKobo / 100n}.${(row.priceKobo % 100n).toString().padStart(2, "0")}`;
  const summary = [
    row.shortDescription,
    row.description,
    row.pricingType === "FIXED" && money !== null
      ? `Published service price: ${money}.`
      : "Quotation required; the price has not been agreed.",
    row.durationMinutes === null
      ? "Duration is not published."
      : `Published service duration: ${row.durationMinutes} minutes.`,
    "This published listing does not prove appointment availability. A request requires staff confirmation; payment does not confirm an appointment.",
  ]
    .filter(Boolean)
    .join("\n");
  // Never crop away a fault, condition or restriction to meet the model budget.
  if (summary.length > 6000) return null;
  return {
    id: `service-${row.id}`,
    title: row.name,
    summary,
    prerequisites: "",
    steps: [],
    outcome: "",
    recovery:
      "Check the current service page or ask the workshop if information is missing.",
    keywords: "service price quotation workshop",
    page: "other",
    href: `/services/${row.id}`,
    source: `Service:${row.id}`,
    version: row.version + 1,
    status: "published",
    reviewedAt: row.updatedAt.toISOString(),
    permission: "public",
    refreshedAt,
    contentHash: createHash("sha256")
      .update(JSON.stringify([row.name, summary]))
      .digest("hex"),
  };
}

export async function retrievePublicKnowledge(
  tx: Prisma.TransactionClient,
  question: string,
  history?: AllieHistory,
): Promise<AllieKnowledge[]> {
  const terms = [...new Set(question.toLowerCase().match(/[\p{L}\p{N}]{3,40}/gu) ?? [])]
    .filter(
      (term) =>
        !/^(the|how|what|does|can|you|for|and|this|that|with|from|please|service|services)$/.test(
          term,
        ),
    )
    .slice(0, 8);
  const previousIds = [
    ...new Set(
      (history?.turns ?? [])
        .slice(-6)
        .flatMap((turn) => turn.sourceIds.slice(0, 4))
        .flatMap((id) => {
          const match = identity.exec(id);
          return match ? [match[1]!] : [];
        }),
    ),
  ];
  const previous = previousIds.length
    ? await tx.service.findMany({
        where: { isActive: true, id: { in: previousIds } },
        select: serviceSelect,
        take: 24,
      })
    : [];
  const matchIds = await rankedPublicKnowledgeIds(tx, "service", terms);
  const matches = matchIds.length
    ? await tx.service.findMany({
        where: { isActive: true, id: { in: matchIds } },
        select: serviceSelect,
        take: 12,
      })
    : [];
  const refreshedAt = new Date().toISOString();
  const catalogueIds = { product: [] as string[], vehicle: [] as string[] };
  for (const id of (history?.turns ?? [])
    .slice(-6)
    .flatMap((turn) => turn.sourceIds.slice(0, 4))) {
    const match =
      /^(product|vehicle)-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@v[1-9]\d*$/.exec(
        id,
      );
    if (match) catalogueIds[match[1] as "product" | "vehicle"].push(match[2]!);
  }
  const catalogue = await retrieveCatalogueKnowledge(
    tx,
    terms,
    catalogueIds,
    refreshedAt,
  );
  const services = [
    ...new Map([...previous, ...matches].map((row) => [row.id, row])).values(),
  ].flatMap((row) => {
    const source = publicServiceSource(row, refreshedAt);
    return source ? [source] : [];
  });
  return [...services, ...catalogue];
}
