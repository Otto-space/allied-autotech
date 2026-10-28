import { z } from "zod";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import {
  catalogueBinding,
  decodeCatalogueCursor,
  encodeCatalogueCursor,
  invalidCatalogueCursor,
} from "../../common/security/catalogue-cursors.js";
import { normalizeSearch } from "../../common/security/catalogue-search.js";
import { productVisibility } from "./product-discovery.repository.js";
import type { ProductOptionQuery } from "./product-options.schemas.js";

const position = z.object({ value: z.string().min(1).max(120) }).strict();
const literal = (value: string) => value.replace(/[\\%_]/g, "\\$&");
export class ProductOptionsRepository {
  constructor(private readonly db: PrismaClient) {}
  async options(query: ProductOptionQuery) {
    const binding = catalogueBinding("product-options-v1", query);
    const after = query.cursor
      ? decodeCatalogueCursor(binding, query.cursor, position).value
      : undefined;
    return this.db.$transaction(
      async (tx) => {
        const scope = productVisibility(this.db, query.criteria);
        let items: { value: string; label: string }[];
        if (query.field === "family") {
          const labels = {
            ENGINE_OIL: "Engine oils",
            REPLACEMENT_PART: "Replacement parts",
          } as const;
          items = [];
          for (const family of ["ENGINE_OIL", "REPLACEMENT_PART"] as const)
            if (
              (!after || family > after) &&
              (!query.search ||
                normalizeSearch(labels[family]).startsWith(
                  normalizeSearch(query.search),
                )) &&
              (await tx.product.findFirst({
                where: { AND: [scope, { family }] },
                select: { id: true },
              }))
            )
              items.push({ value: family, label: labels[family] });
        } else if (query.field === "brand") {
          const rows = await tx.product.groupBy({
            by: ["brandKey"],
            where: {
              AND: [
                scope,
                {
                  brandKey: {
                    not: null,
                    ...(after ? { gt: after } : {}),
                    ...(query.search
                      ? { startsWith: literal(normalizeSearch(query.search)) }
                      : {}),
                  },
                },
              ],
            },
            _min: { brand: true },
            orderBy: { brandKey: "asc" },
            take: query.limit + 1,
          });
          items = rows.flatMap((row) =>
            row.brandKey && row._min.brand
              ? [{ value: row.brandKey, label: row._min.brand }]
              : [],
          );
        } else if (query.field === "packVolumeMl") {
          if (after && !/^[1-9][0-9]{0,6}$/.test(after)) throw invalidCatalogueCursor();
          const rows = await tx.product.groupBy({
            by: ["packVolumeMl"],
            where: {
              AND: [
                scope,
                { packVolumeMl: { not: null, ...(after ? { gt: Number(after) } : {}) } },
              ],
            },
            orderBy: { packVolumeMl: "asc" },
            take: query.limit + 1,
          });
          items = rows.flatMap((row) =>
            row.packVolumeMl === null
              ? []
              : [
                  {
                    value: String(row.packVolumeMl),
                    label:
                      row.packVolumeMl % 1000 === 0
                        ? `${row.packVolumeMl / 1000} L`
                        : `${row.packVolumeMl} ml`,
                  },
                ],
          );
        } else {
          const field = query.field;
          const where: Prisma.ProductWhereInput = {
            AND: [
              scope,
              {
                [field]: {
                  not: null,
                  ...(after ? { gt: after } : {}),
                  ...(query.search
                    ? { startsWith: literal(query.search), mode: "insensitive" }
                    : {}),
                },
              },
            ],
          };
          if (field === "oilViscosityGrade") {
            const rows = await tx.product.groupBy({
              by: ["oilViscosityGrade"],
              where,
              orderBy: { oilViscosityGrade: "asc" },
              take: query.limit + 1,
            });
            items = rows.flatMap((row) =>
              row.oilViscosityGrade
                ? [{ value: row.oilViscosityGrade, label: row.oilViscosityGrade }]
                : [],
            );
          } else {
            const rows = await tx.product.groupBy({
              by: ["productType"],
              where,
              orderBy: { productType: "asc" },
              take: query.limit + 1,
            });
            items = rows.flatMap((row) =>
              row.productType
                ? [
                    {
                      value: row.productType,
                      label: row.productType.replaceAll("_", " "),
                    },
                  ]
                : [],
            );
          }
        }
        const visible = items.slice(0, query.limit),
          last = visible.at(-1);
        return {
          items: visible,
          ...(items.length > query.limit && last
            ? { nextCursor: encodeCatalogueCursor(binding, { value: last.value }) }
            : {}),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
