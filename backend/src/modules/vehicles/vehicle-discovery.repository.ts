import { z } from "zod";
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

const positionSchema = z.object({ id: z.uuid(), value: z.string().max(32) }).strict();
function valueOf(
  row: { createdAt: Date; priceKobo: bigint; vehicle: { year: number } },
  sort: VehicleDiscoveryQuery["sort"],
) {
  return sort === "newest"
    ? row.createdAt.toISOString()
    : sort === "year_desc"
      ? String(row.vehicle.year)
      : row.priceKobo.toString();
}
function afterPosition(
  position: z.infer<typeof positionSchema>,
  sort: VehicleDiscoveryQuery["sort"],
): Prisma.VehicleListingWhereInput {
  if (sort === "newest") {
    if (!z.iso.datetime().safeParse(position.value).success)
      throw invalidCatalogueCursor();
    const at = new Date(position.value);
    return {
      OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: position.id } }],
    };
  }
  if (sort === "year_desc") {
    if (!/^\d{4}$/.test(position.value)) throw invalidCatalogueCursor();
    const year = Number(position.value);
    return {
      OR: [
        { vehicle: { year: { lt: year } } },
        { vehicle: { year }, id: { lt: position.id } },
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
    const binding = catalogueBinding("vehicle-discovery", query);
    const visibility = publicWhere(query);
    // Page and exact total share a PostgreSQL snapshot. Subsequent pages are fresh reads.
    return this.db.$transaction(
      async (tx) => {
        let position;
        if (query.cursor) {
          if (z.uuid().safeParse(query.cursor).success) {
            // Old shared links can start traversal only from a currently matching public row.
            const row = await tx.vehicleListing.findFirst({
              where: { AND: [visibility, { id: query.cursor }] },
              select: publicListingSelect,
            });
            if (!row) throw invalidCatalogueCursor();
            position = { id: row.id, value: valueOf(row, query.sort) };
          } else position = decodeCatalogueCursor(binding, query.cursor, positionSchema);
        }
        const rows = await tx.vehicleListing.findMany({
          where: position
            ? { AND: [visibility, afterPosition(position, query.sort)] }
            : visibility,
          select: publicListingSelect,
          orderBy: publicOrder(query.sort),
          take: query.limit + 1,
        });
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
