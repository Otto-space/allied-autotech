import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import type {
  AdminCategoryListQuery,
  AdminProductListQuery,
  CategoryCreateInput,
  CategoryListQuery,
  CategoryUpdateInput,
  CompatibilityCreateInput,
  CompatibilityUpdateInput,
  FavouriteListQuery,
  ImageCreateInput,
  ImageUpdateInput,
  ProductCreateInput,
  ProductListQuery,
  ProductUpdateInput,
} from "./catalog.schemas.js";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CategorySelect;

export const productSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  brand: true,
  manufacturerPartNumber: true,
  description: true,
  priceKobo: true,
  compareAtPriceKobo: true,
  currency: true,
  isActive: true,
  featured: true,
  createdAt: true,
  updatedAt: true,
  category: { select: categorySelect },
  images: {
    select: {
      id: true,
      url: true,
      altText: true,
      sortOrder: true,
      isPrimary: true,
      createdAt: true,
    },
    orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
  },
  compatibilities: {
    select: {
      id: true,
      make: true,
      model: true,
      yearFrom: true,
      yearTo: true,
      notes: true,
    },
    orderBy: { id: "asc" as const },
  },
  inventories: {
    where: { branch: { isActive: true } },
    select: {
      quantity: true,
      reserved: true,
      branch: { select: { id: true, code: true, name: true } },
    },
  },
} satisfies Prisma.ProductSelect;

function productWhere(
  query: ProductListQuery | AdminProductListQuery,
  activeOnly: boolean,
): Prisma.ProductWhereInput {
  return {
    ...(activeOnly
      ? { isActive: true, category: { isActive: true } }
      : "isActive" in query && query.isActive !== undefined
        ? { isActive: query.isActive }
        : {}),
    ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
    ...(query.brand === undefined
      ? {}
      : { brand: { equals: query.brand, mode: "insensitive" } }),
    ...(query.featured === undefined ? {} : { featured: query.featured }),
    ...(query.search === undefined
      ? {}
      : {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { sku: { contains: query.search, mode: "insensitive" } },
            { brand: { contains: query.search, mode: "insensitive" } },
            { manufacturerPartNumber: { contains: query.search, mode: "insensitive" } },
          ],
        }),
    ...(query.make === undefined && query.model === undefined && query.year === undefined
      ? {}
      : {
          compatibilities: {
            some: {
              ...(query.make === undefined
                ? {}
                : { make: { equals: query.make, mode: "insensitive" } }),
              ...(query.model === undefined
                ? {}
                : { model: { equals: query.model, mode: "insensitive" } }),
              ...(query.year === undefined
                ? {}
                : {
                    AND: [
                      { OR: [{ yearFrom: null }, { yearFrom: { lte: query.year } }] },
                      { OR: [{ yearTo: null }, { yearTo: { gte: query.year } }] },
                    ],
                  }),
            },
          },
        }),
  };
}

function productOrder(
  sort: ProductListQuery["sort"],
): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "name":
      return [{ name: "asc" }, { id: "asc" }];
    case "price_asc":
      return [{ priceKobo: "asc" }, { id: "asc" }];
    case "price_desc":
      return [{ priceKobo: "desc" }, { id: "desc" }];
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

export class CatalogRepository {
  constructor(private readonly database: PrismaClient = prisma) {}

  listCategories(
    query: CategoryListQuery | AdminCategoryListQuery,
    activeOnly: boolean,
    client: DatabaseClient = this.database,
  ) {
    return client.category.findMany({
      where: activeOnly
        ? { isActive: true }
        : "isActive" in query && query.isActive !== undefined
          ? { isActive: query.isActive }
          : {},
      select: categorySelect,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }

  category(id: string, activeOnly: boolean, client: DatabaseClient = this.database) {
    return client.category.findFirst({
      where: { id, ...(activeOnly ? { isActive: true } : {}) },
      select: categorySelect,
    });
  }

  createCategory(input: CategoryCreateInput, client: DatabaseClient) {
    return client.category.create({
      data: {
        name: input.name,
        slug: input.slug,
        isActive: input.isActive,
        description: input.description ?? null,
      },
      select: categorySelect,
    });
  }

  updateCategory(id: string, input: CategoryUpdateInput, client: DatabaseClient) {
    const data: Prisma.CategoryUncheckedUpdateInput = {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.slug === undefined ? {} : { slug: input.slug }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    };
    return client.category.update({ where: { id }, data, select: categorySelect });
  }

  listProducts(
    query: ProductListQuery | AdminProductListQuery,
    activeOnly: boolean,
    client: DatabaseClient = this.database,
  ) {
    return client.product.findMany({
      where: productWhere(query, activeOnly),
      select: productSelect,
      orderBy: productOrder(query.sort),
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }

  product(id: string, activeOnly: boolean, client: DatabaseClient = this.database) {
    return client.product.findFirst({
      where: {
        id,
        ...(activeOnly ? { isActive: true, category: { isActive: true } } : {}),
      },
      select: productSelect,
    });
  }

  createProduct(input: ProductCreateInput, client: DatabaseClient) {
    return client.product.create({
      data: {
        categoryId: input.categoryId,
        name: input.name,
        slug: input.slug,
        sku: input.sku,
        priceKobo: BigInt(input.priceKobo),
        currency: input.currency,
        isActive: input.isActive,
        featured: input.featured,
        brand: input.brand ?? null,
        manufacturerPartNumber: input.manufacturerPartNumber ?? null,
        description: input.description ?? null,
        compareAtPriceKobo:
          input.compareAtPriceKobo == null ? null : BigInt(input.compareAtPriceKobo),
      },
      select: productSelect,
    });
  }

  updateProduct(id: string, input: ProductUpdateInput, client: DatabaseClient) {
    const data: Prisma.ProductUncheckedUpdateInput = {
      ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.slug === undefined ? {} : { slug: input.slug }),
      ...(input.sku === undefined ? {} : { sku: input.sku }),
      ...(input.brand === undefined ? {} : { brand: input.brand }),
      ...(input.manufacturerPartNumber === undefined
        ? {}
        : { manufacturerPartNumber: input.manufacturerPartNumber }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.priceKobo === undefined ? {} : { priceKobo: BigInt(input.priceKobo) }),
      ...(input.compareAtPriceKobo === undefined
        ? {}
        : {
            compareAtPriceKobo:
              input.compareAtPriceKobo === null ? null : BigInt(input.compareAtPriceKobo),
          }),
      ...(input.currency === undefined ? {} : { currency: input.currency }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      ...(input.featured === undefined ? {} : { featured: input.featured }),
    };
    return client.product.update({ where: { id }, data, select: productSelect });
  }

  createCompatibility(
    productId: string,
    input: CompatibilityCreateInput,
    client: DatabaseClient,
  ) {
    return client.productCompatibility.create({
      data: {
        productId,
        make: input.make,
        model: input.model ?? null,
        yearFrom: input.yearFrom ?? null,
        yearTo: input.yearTo ?? null,
        notes: input.notes ?? null,
      },
    });
  }
  updateCompatibility(
    productId: string,
    id: string,
    input: CompatibilityUpdateInput,
    client: DatabaseClient,
  ) {
    const data: Prisma.ProductCompatibilityUncheckedUpdateInput = {
      ...(input.make === undefined ? {} : { make: input.make }),
      ...(input.model === undefined ? {} : { model: input.model }),
      ...(input.yearFrom === undefined ? {} : { yearFrom: input.yearFrom }),
      ...(input.yearTo === undefined ? {} : { yearTo: input.yearTo }),
      ...(input.notes === undefined ? {} : { notes: input.notes }),
    };
    return client.productCompatibility.update({ where: { id, productId }, data });
  }
  deleteCompatibility(productId: string, id: string, client: DatabaseClient) {
    return client.productCompatibility.delete({ where: { id, productId } });
  }

  async createImage(productId: string, input: ImageCreateInput, client: DatabaseClient) {
    if (input.isPrimary)
      await client.productImage.updateMany({
        where: { productId, isPrimary: true },
        data: { isPrimary: false },
      });
    return client.productImage.create({
      data: {
        productId,
        url: input.url,
        altText: input.altText ?? null,
        sortOrder: input.sortOrder,
        isPrimary: input.isPrimary,
      },
      select: {
        id: true,
        url: true,
        altText: true,
        sortOrder: true,
        isPrimary: true,
        createdAt: true,
      },
    });
  }
  async updateImage(
    productId: string,
    id: string,
    input: ImageUpdateInput,
    client: DatabaseClient,
  ) {
    if (input.isPrimary)
      await client.productImage.updateMany({
        where: { productId, isPrimary: true, id: { not: id } },
        data: { isPrimary: false },
      });
    const data: Prisma.ProductImageUncheckedUpdateInput = {
      ...(input.url === undefined ? {} : { url: input.url }),
      ...(input.altText === undefined ? {} : { altText: input.altText }),
      ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
      ...(input.isPrimary === undefined ? {} : { isPrimary: input.isPrimary }),
    };
    return client.productImage.update({
      where: { id, productId },
      data,
      select: {
        id: true,
        url: true,
        altText: true,
        sortOrder: true,
        isPrimary: true,
        createdAt: true,
      },
    });
  }
  deleteImage(productId: string, id: string, client: DatabaseClient) {
    return client.productImage.delete({ where: { id, productId }, select: { id: true } });
  }

  listFavourites(userId: string, query: FavouriteListQuery) {
    return this.database.productFavourite.findMany({
      where: {
        customer: { userId },
        product: { isActive: true, category: { isActive: true } },
      },
      select: { id: true, createdAt: true, product: { select: productSelect } },
      orderBy: { id: "asc" },
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }
  async addFavourite(userId: string, productId: string, client: DatabaseClient) {
    const customer = await client.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (customer === null) return null;
    return client.productFavourite.upsert({
      where: { customerId_productId: { customerId: customer.id, productId } },
      create: { customerId: customer.id, productId },
      update: {},
      select: { id: true, createdAt: true, product: { select: productSelect } },
    });
  }
  async removeFavourite(userId: string, productId: string, client: DatabaseClient) {
    return (
      (
        await client.productFavourite.deleteMany({
          where: { productId, customer: { userId } },
        })
      ).count === 1
    );
  }

  cart(userId: string, client: DatabaseClient = this.database) {
    return client.cart.findFirst({
      where: { customer: { userId } },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            quantity: true,
            createdAt: true,
            updatedAt: true,
            product: { select: productSelect },
          },
          orderBy: { id: "asc" },
        },
      },
    });
  }
  async setCartItem(
    userId: string,
    productId: string,
    quantity: number,
    client: DatabaseClient,
  ) {
    const customer = await client.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (customer === null) return null;
    const cart = await client.cart.upsert({
      where: { customerId: customer.id },
      create: { customerId: customer.id },
      update: {},
      select: { id: true },
    });
    await client.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      create: { cartId: cart.id, productId, quantity },
      update: { quantity },
    });
    return this.cart(userId, client);
  }
  async removeCartItem(userId: string, productId: string, client: DatabaseClient) {
    return (
      (
        await client.cartItem.deleteMany({
          where: { productId, cart: { customer: { userId } } },
        })
      ).count === 1
    );
  }
  async clearCart(userId: string, client: DatabaseClient) {
    const cart = await client.cart.findFirst({
      where: { customer: { userId } },
      select: { id: true },
    });
    if (cart === null) return 0;
    return (await client.cartItem.deleteMany({ where: { cartId: cart.id } })).count;
  }
}
