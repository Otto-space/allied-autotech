import { Prisma } from "../../generated/prisma/client.js";

// Rank in the database before limiting candidates. Only public fields participate;
// callers still apply their canonical public selectors when loading these IDs.
export async function rankedPublicKnowledgeIds(
  tx: Prisma.TransactionClient,
  kind: "service" | "product" | "vehicle",
  terms: string[],
): Promise<string[]> {
  const bounded = [...new Set(terms)]
    .filter((term) => term.length >= 3 && term.length <= 40)
    .slice(0, 8);
  if (!bounded.length) return [];
  const rows =
    kind === "service"
      ? Prisma.sql`SELECT "id", "name" AS title, concat_ws(' ', "shortDescription", "description") AS body FROM "Service" WHERE "isActive"`
      : kind === "product"
        ? Prisma.sql`SELECT p."id", concat_ws(' ',p."name",p."brand") AS title, p."description" AS body FROM "Product" p JOIN "Category" c ON c."id"=p."categoryId" LEFT JOIN "Category" parent ON parent."id"=c."parentId" WHERE p."isActive" AND c."isActive" AND (c."parentId" IS NULL OR parent."isActive")`
        : Prisma.sql`SELECT l."id", concat_ws(' ',l."title",v."make",v."model") AS title,l."description" AS body FROM "VehicleListing" l JOIN "Vehicle" v ON v."id"=l."vehicleId" JOIN "Branch" b ON b."id"=l."branchId" WHERE l."status"='AVAILABLE' AND b."isActive"`;
  const result = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    WITH public_rows AS (${rows})
    SELECT r.id FROM public_rows r
    CROSS JOIN LATERAL (
      SELECT count(*) FILTER (WHERE position(term IN lower(r.title))>0) AS title_matches,
        count(*) FILTER (WHERE position(term IN lower(coalesce(r.body,'')))>0) AS body_matches
      FROM unnest(ARRAY[${Prisma.join(bounded.map((term) => Prisma.sql`${term.toLowerCase()}::text`))}]) AS terms(term)
    ) score
    WHERE score.title_matches + score.body_matches > 0
    ORDER BY score.title_matches DESC, score.body_matches DESC, r.id ASC
    LIMIT 12
  `);
  return result.map((row) => row.id);
}
