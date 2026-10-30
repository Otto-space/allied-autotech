import { rankedPublicKnowledgeIds } from "./allie.knowledge-ranking.js";
import { createHash } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client.js";
import { activeProductWhere } from "../catalog/catalog-visibility.js";
import { publicListingSelect, publicWhere } from "../vehicles/vehicles.repository.js";
import type { AllieKnowledge } from "./allie.contracts.js";

const productSelect = {
  id: true,
  name: true,
  brand: true,
  description: true,
  priceKobo: true,
  currency: true,
  condition: true,
  classification: true,
  productType: true,
  oilViscosityGrade: true,
  packVolumeMl: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;
const vehicleSelect = {
  id: true,
  title: true,
  description: true,
  priceKobo: true,
  currency: true,
  version: true,
  updatedAt: true,
  branch: publicListingSelect.branch,
  vehicle: {
    select: {
      make: true,
      model: true,
      year: true,
      trim: true,
      mileageKm: true,
      transmission: true,
      fuelType: true,
      condition: true,
      bodyType: true,
      engineCapacityCc: true,
      features: true,
      ownerReportedCondition: true,
      ownerReportedIssues: true,
      conditionReports: publicListingSelect.vehicle.select.conditionReports,
    },
  },
} satisfies Prisma.VehicleListingSelect;
const money = (currency: string, amount: bigint) =>
  `${currency} ${amount / 100n}.${(amount % 100n).toString().padStart(2, "0")}`;
function source(
  kind: "product" | "vehicle",
  id: string,
  title: string,
  summary: string,
  version: number,
  updatedAt: Date,
  refreshedAt: string,
): AllieKnowledge | null {
  if (summary.length > 6000) return null;
  const page = kind === "product" ? "parts" : "vehicles";
  return {
    id: `${kind}-${id}`,
    title,
    summary,
    prerequisites: "",
    steps: [],
    outcome: "",
    recovery:
      "Read the current listing and ask the team to confirm any missing information.",
    keywords: kind === "product" ? "part product price" : "car vehicle price condition",
    page,
    href: `/${page}/${id}`,
    source: `${kind}:${id}`,
    version,
    status: "published",
    reviewedAt: updatedAt.toISOString(),
    permission: "public",
    refreshedAt,
    contentHash: createHash("sha256")
      .update(JSON.stringify([title, summary]))
      .digest("hex"),
  };
}
export async function catalogueKnowledgeRevision(tx: Prisma.TransactionClient) {
  const [row] = await tx.$queryRaw<{ revision: string }[]>`
    WITH records AS (
      SELECT 'product:' || p."id"::text AS id, jsonb_build_array(
        p."name", p."brand", p."description", p."priceKobo"::text, p."currency",
        p."condition", p."classification", p."productType", p."oilViscosityGrade",
        p."packVolumeMl", p."updatedAt"
      ) AS data FROM "Product" p
      JOIN "Category" c ON c."id" = p."categoryId"
      LEFT JOIN "Category" parent ON parent."id" = c."parentId"
      WHERE p."isActive" AND c."isActive" AND (c."parentId" IS NULL OR parent."isActive")
      UNION ALL
      SELECT 'vehicle:' || l."id"::text, jsonb_build_array(
        l."title", l."description", l."priceKobo"::text, l."currency", l."version", l."updatedAt",
        b."name", b."code", b."city", b."state", v."make", v."model", v."year", v."trim",
        v."mileageKm", v."transmission", v."fuelType", v."condition", v."bodyType",
        v."engineCapacityCc", v."features", v."ownerReportedCondition", v."ownerReportedIssues",
        (SELECT jsonb_agg(jsonb_build_array(r."id", r."summary", r."findings", r."inspectedAt",
          r."odometerKm", r."conditionScore") ORDER BY r."inspectedAt", r."id")
          FROM "VehicleConditionReport" r WHERE r."vehicleId" = v."id")
      ) FROM "VehicleListing" l
      JOIN "Vehicle" v ON v."id" = l."vehicleId"
      JOIN "Branch" b ON b."id" = l."branchId"
      WHERE l."status" = 'AVAILABLE' AND b."isActive"
    )
    SELECT encode(sha256(convert_to(COALESCE(string_agg(
      id || encode(sha256(convert_to(data::text, 'UTF8')), 'hex'), '' ORDER BY id
    ), ''), 'UTF8')), 'hex') AS revision FROM records
  `;
  return row!.revision;
}
export async function retrieveCatalogueKnowledge(
  tx: Prisma.TransactionClient,
  terms: string[],
  previousIds: { product: string[]; vehicle: string[] },
  refreshedAt: string,
) {
  const productIds = await rankedPublicKnowledgeIds(tx, "product", terms);
  const productMatches = productIds.length
    ? await tx.product.findMany({
        where: { AND: [activeProductWhere, { id: { in: productIds } }] },
        select: productSelect,
        take: 12,
      })
    : [];
  const vehicleIds = await rankedPublicKnowledgeIds(tx, "vehicle", terms);
  const vehicleMatches = vehicleIds.length
    ? await tx.vehicleListing.findMany({
        where: { AND: [publicWhere({ limit: 12 }), { id: { in: vehicleIds } }] },
        select: vehicleSelect,
        take: 12,
      })
    : [];
  const previousProducts = previousIds.product.length
    ? await tx.product.findMany({
        where: { AND: [activeProductWhere, { id: { in: previousIds.product } }] },
        select: productSelect,
        take: 24,
      })
    : [];
  const previousVehicles = previousIds.vehicle.length
    ? await tx.vehicleListing.findMany({
        where: { AND: [publicWhere({ limit: 12 }), { id: { in: previousIds.vehicle } }] },
        select: vehicleSelect,
        take: 24,
      })
    : [];
  const products = [
    ...new Map(
      [...previousProducts, ...productMatches].map((row) => [row.id, row]),
    ).values(),
  ];
  const vehicles = [
    ...new Map(
      [...previousVehicles, ...vehicleMatches].map((row) => [row.id, row]),
    ).values(),
  ];
  const results: AllieKnowledge[] = [];
  for (const row of products) {
    const summary = [
      row.description,
      `Published product price: ${money(row.currency, row.priceKobo)}.`,
      row.brand && `Brand: ${row.brand}.`,
      row.condition && `Condition: ${row.condition}.`,
      row.classification && `Classification: ${row.classification}.`,
      row.productType,
      row.oilViscosityGrade && `Oil viscosity: ${row.oilViscosityGrade}.`,
      row.packVolumeMl !== null && `Pack volume: ${row.packVolumeMl} ml.`,
      "This listing does not establish stock or compatibility with your vehicle. Check the product's fitment result with your vehicle details and ask the team if it is unknown. No delivery or paid vehicle reservation is offered by this source.",
    ]
      .filter(Boolean)
      .join("\n");
    const item = source(
      "product",
      row.id,
      row.name,
      summary,
      1,
      row.updatedAt,
      refreshedAt,
    );
    if (item) results.push(item);
  }
  for (const row of vehicles) {
    const { conditionReports, ...details } = row.vehicle;
    const summary = [
      row.description,
      `Published asking price: ${money(row.currency, row.priceKobo)}.`,
      `Location: ${row.branch.name}, ${row.branch.city}, ${row.branch.state}.`,
      `Published vehicle details: ${JSON.stringify(details)}`,
      conditionReports.length
        ? `Latest published inspection: ${JSON.stringify(conditionReports[0])}`
        : "No inspection report is published.",
      "Owner-reported condition is not an independent safety assessment. Missing faults or inspection information do not mean fault-free. Ask for an inspection; this source does not reserve the vehicle or authorise payment.",
    ]
      .filter(Boolean)
      .join("\n");
    const item = source(
      "vehicle",
      row.id,
      row.title,
      summary,
      row.version + 1,
      row.updatedAt,
      refreshedAt,
    );
    if (item) results.push(item);
  }
  return results;
}
