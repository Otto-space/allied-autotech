import { z } from "zod";
import { vehicleSearchTiers } from "../../common/security/catalogue-search.js";
import { prisma } from "../../config/database.js";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import {
  catalogueBinding,
  decodeCatalogueCursor,
  encodeCatalogueCursor,
  invalidCatalogueCursor,
} from "../../common/security/catalogue-cursors.js";
import { publicListingSelect, publicOrder, publicWhere } from "./vehicles.repository.js";
import type {
  VehicleDiscoveryQuery,
  VehicleFacetQuery,
} from "./vehicle-discovery.schemas.js";
import { vehicleJsonSafe } from "./vehicles.types.js";

const positionSchema = z
  .object({
    id: z.uuid(),
    value: z.string().max(32),
    rank: z.number().int().min(1).max(4).optional(),
  })
  .strict();
function valueOf(
  row: {
    createdAt: Date;
    priceKobo: bigint;
    vehicle: { year: number; mileageKm: number | null };
  },
  sort: VehicleDiscoveryQuery["sort"],
) {
  return sort === "newest" || sort === "best_match"
    ? row.createdAt.toISOString()
    : sort === "year_desc" || sort === "year_asc"
      ? String(row.vehicle.year)
      : sort === "mileage_asc" || sort === "mileage_desc"
        ? row.vehicle.mileageKm === null
          ? "unknown"
          : String(row.vehicle.mileageKm)
        : row.priceKobo.toString();
}
function afterPosition(
  position: z.infer<typeof positionSchema>,
  sort: VehicleDiscoveryQuery["sort"],
): Prisma.VehicleListingWhereInput {
  if (sort === "newest" || sort === "best_match") {
    if (!z.iso.datetime().safeParse(position.value).success)
      throw invalidCatalogueCursor();
    const at = new Date(position.value);
    return {
      OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: position.id } }],
    };
  }
  if (sort === "mileage_asc" || sort === "mileage_desc") {
    const comparison = sort === "mileage_asc" ? "gt" : "lt";
    if (position.value === "unknown")
      return { vehicle: { mileageKm: null }, id: { [comparison]: position.id } };
    if (!/^\d{1,8}$/.test(position.value) || Number(position.value) > 10000000)
      throw invalidCatalogueCursor();
    const mileageKm = Number(position.value);
    return {
      OR: [
        { vehicle: { mileageKm: { [comparison]: mileageKm } } },
        { vehicle: { mileageKm: null } },
        { vehicle: { mileageKm }, id: { [comparison]: position.id } },
      ],
    };
  }
  if (sort === "year_desc" || sort === "year_asc") {
    if (!/^\d{4}$/.test(position.value)) throw invalidCatalogueCursor();
    const year = Number(position.value);
    return {
      OR: [
        { vehicle: { year: sort === "year_asc" ? { gt: year } : { lt: year } } },
        {
          vehicle: { year },
          id: sort === "year_asc" ? { gt: position.id } : { lt: position.id },
        },
      ],
    };
  }
  if (!/^[1-9][0-9]{0,15}$/.test(position.value)) throw invalidCatalogueCursor();
  const priceKobo = BigInt(position.value);
  return {
    OR: [
      { priceKobo: sort === "price_asc" ? { gt: priceKobo } : { lt: priceKobo } },
      { priceKobo, id: sort === "price_asc" ? { gt: position.id } : { lt: position.id } },
    ],
  };
}

export class VehicleDiscoveryRepository {
  constructor(private readonly db: PrismaClient = prisma) {}
  async listings(query: VehicleDiscoveryQuery) {
    const binding = catalogueBinding("vehicle-discovery-v2", query);
    const visibility = publicWhere(query, true);
    // Page and exact total share a PostgreSQL snapshot. Subsequent pages are fresh reads.
    return this.db.$transaction(
      async (tx) => {
        let position: z.infer<typeof positionSchema> | undefined;
        const tiers = vehicleSearchTiers(query.search ?? "");
        if (query.cursor) {
          if (z.uuid().safeParse(query.cursor).success) {
            // Old shared links can start traversal only from a currently matching public row.
            const row = await tx.vehicleListing.findFirst({
              where: { AND: [visibility, { id: query.cursor }] },
              select: publicListingSelect,
            });
            if (!row) throw invalidCatalogueCursor();
            position = { id: row.id, value: valueOf(row, query.sort) };
            if (query.sort === "best_match") {
              for (let i = 1; i < tiers.length; i++)
                if (
                  await tx.vehicleListing.findFirst({
                    where: { AND: [visibility, { id: row.id }, tiers[i]!] },
                    select: { id: true },
                  })
                ) {
                  position.rank = i + 1;
                  break;
                }
            }
          } else position = decodeCatalogueCursor(binding, query.cursor, positionSchema);
        }
        const rows: Prisma.VehicleListingGetPayload<{
          select: typeof publicListingSelect;
        }>[] = [];
        const ranks = new Map<string, number>();
        if (query.sort === "best_match") {
          if (position && !position.rank) throw invalidCatalogueCursor();
          for (let rank = position?.rank ?? 2; rank <= 4; rank++) {
            const page = await tx.vehicleListing.findMany({
              where: {
                AND: [
                  visibility,
                  tiers[rank - 1]!,
                  ...(rank > 2 ? [{ NOT: { OR: tiers.slice(1, rank - 1) } }] : []),
                  ...(position && rank === position.rank
                    ? [afterPosition(position, "newest")]
                    : []),
                ],
              },
              select: publicListingSelect,
              orderBy: publicOrder("newest"),
              take: query.limit + 1 - rows.length,
            });
            for (const row of page) {
              rows.push(row);
              ranks.set(row.id, rank);
            }
            if (rows.length > query.limit) break;
          }
        } else
          rows.push(
            ...(await tx.vehicleListing.findMany({
              where: position
                ? { AND: [visibility, afterPosition(position, query.sort)] }
                : visibility,
              select: publicListingSelect,
              orderBy: publicOrder(query.sort),
              take: query.limit + 1,
            })),
          );
        const totalMatches = await tx.vehicleListing.count({ where: visibility });
        const items = rows.slice(0, query.limit),
          last = items.at(-1);
        return vehicleJsonSafe({
          items,
          totalMatches,
          ...(rows.length > query.limit && last
            ? {
                nextCursor: encodeCatalogueCursor(binding, {
                  id: last.id,
                  value: valueOf(last, query.sort),
                  ...(query.sort === "best_match" ? { rank: ranks.get(last.id) } : {}),
                }),
              }
            : {}),
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async facets(query: VehicleFacetQuery) {
    const binding = catalogueBinding("vehicle-facets", query);
    const after = query.cursor
      ? decodeCatalogueCursor(binding, query.cursor, z.string().min(1).max(80))
      : undefined;
    const column = query.field === "make" ? Prisma.sql`v."make"` : Prisma.sql`v."model"`;
    const value = Prisma.sql`lower(${column}) COLLATE "C"`;
    const clauses = [
      Prisma.sql`EXISTS (SELECT 1 FROM "VehicleListing" l JOIN "Branch" b ON b."id" = l."branchId" WHERE l."vehicleId" = v."id" AND l."status" = 'AVAILABLE' AND b."isActive" = true)`,
    ];
    if (query.make)
      clauses.push(
        Prisma.sql`lower(v."make") COLLATE "C" = lower(${query.make}) COLLATE "C"`,
      );
    if (query.search) {
      const prefix = query.search.replace(/[\\%_]/g, "\\$&") + "%";
      clauses.push(Prisma.sql`${value} LIKE lower(${prefix}) COLLATE "C"`);
    }
    if (after) clauses.push(Prisma.sql`${value} > ${after} COLLATE "C"`);
    const rows = await this.db.$queryRaw<{ value: string; label: string }[]>(Prisma.sql`
      SELECT ${value} AS value, min(${column} COLLATE "C") AS label
      FROM "Vehicle" v WHERE ${Prisma.join(clauses, " AND ")}
      GROUP BY ${value} ORDER BY value ASC LIMIT ${query.limit + 1}`);
    const items = rows.slice(0, query.limit),
      last = items.at(-1);
    return {
      items,
      ...(rows.length > query.limit && last
        ? { nextCursor: encodeCatalogueCursor(binding, last.value) }
        : {}),
    };
  }
}
