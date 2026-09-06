import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { prisma } from "../../config/database.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { catalogConflict, catalogResourceNotFound } from "./catalog.errors.js";
import { assertCatalogueAdministrator, assertCustomer } from "./catalog.policy.js";
import { CatalogRepository } from "./catalog.repository.js";
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
import { page } from "./catalog.types.js";

interface InventoryAvailability {
  quantity: number;
  reserved: number;
  branch: { id: string; code: string; name: string };
}

function productView<
  T extends {
    priceKobo: bigint;
    compareAtPriceKobo: bigint | null;
    inventories: InventoryAvailability[];
  },
>(product: T) {
  const { inventories, ...safe } = product;
  return {
    ...safe,
    priceKobo: product.priceKobo.toString(),
    compareAtPriceKobo: product.compareAtPriceKobo?.toString() ?? null,
    availability: inventories.map(({ branch, quantity, reserved }) => ({
      branch,
      inStock: quantity - reserved > 0,
    })),
  };
}

function productPage<
  T extends {
    id: string;
    priceKobo: bigint;
    compareAtPriceKobo: bigint | null;
    inventories: InventoryAvailability[];
  },
>(rows: T[], limit: number) {
  const result = page(rows, limit);
  return { ...result, items: result.items.map(productView) };
}

export class CatalogService {
  private readonly repository: CatalogRepository;
  constructor(private readonly database: PrismaClient = prisma) {
    this.repository = new CatalogRepository(database);
  }

  async publicCategories(query: CategoryListQuery) {
    return page(await this.repository.listCategories(query, true), query.limit);
  }
  async publicCategory(id: string) {
    const category = await this.repository.category(id, true);
    if (category === null) throw catalogResourceNotFound();
    return category;
  }
  async publicProducts(query: ProductListQuery) {
    return productPage(await this.repository.listProducts(query, true), query.limit);
  }
  async publicProduct(id: string) {
    const product = await this.repository.product(id, true);
    if (product === null) throw catalogResourceNotFound();
    return productView(product);
  }
  async categories(actor: AuthenticatedActor, query: AdminCategoryListQuery) {
    assertCatalogueAdministrator(actor);
    return page(await this.repository.listCategories(query, false), query.limit);
  }
  async products(actor: AuthenticatedActor, query: AdminProductListQuery) {
    assertCatalogueAdministrator(actor);
    return productPage(await this.repository.listProducts(query, false), query.limit);
  }

  async createCategory(
    actor: AuthenticatedActor,
    input: CategoryCreateInput,
    context: RequestSecurityContext,
  ) {
    assertCatalogueAdministrator(actor);
    return this.database.$transaction(async (transaction) => {
      const category = await this.repository.createCategory(input, transaction);
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "PRODUCT",
        entityId: category.id,
        newValues: {
          resourceType: "CATEGORY",
          slug: category.slug,
          active: category.isActive,
        },
        context,
      });
      return category;
    });
  }

  async updateCategory(
    actor: AuthenticatedActor,
    id: string,
    input: CategoryUpdateInput,
    context: RequestSecurityContext,
  ) {
    assertCatalogueAdministrator(actor);
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`category:${id}`}, 0))`;
      const existing = await this.repository.category(id, false, transaction);
      if (existing === null) throw catalogResourceNotFound();
      if (
        input.isActive === false &&
        existing.isActive &&
        (await transaction.product.count({ where: { categoryId: id, isActive: true } })) >
          0
      ) {
        throw catalogConflict(
          "Deactivate category products before deactivating the category",
        );
      }
      const category = await this.repository.updateCategory(id, input, transaction);
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: input.isActive === undefined ? "UPDATE" : "STATUS_CHANGE",
        entityType: "PRODUCT",
        entityId: id,
        oldValues: { resourceType: "CATEGORY", active: existing.isActive },
        newValues: {
          resourceType: "CATEGORY",
          active: category.isActive,
          changedFields: Object.keys(input).sort().join(","),
        },
        context,
      });
      return category;
    });
  }

  async createProduct(
    actor: AuthenticatedActor,
    input: ProductCreateInput,
    context: RequestSecurityContext,
  ) {
    assertCatalogueAdministrator(actor);
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`category:${input.categoryId}`}, 0))`;
      const category = await this.repository.category(
        input.categoryId,
        false,
        transaction,
      );
      if (category === null) throw catalogResourceNotFound();
      if (input.isActive && !category.isActive)
        throw catalogConflict("An active product requires an active category");
      const product = await this.repository.createProduct(input, transaction);
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "PRODUCT",
        entityId: product.id,
        newValues: {
          categoryId: input.categoryId,
          sku: product.sku,
          active: product.isActive,
        },
        context,
      });
      return productView(product);
    });
  }

  async updateProduct(
    actor: AuthenticatedActor,
    id: string,
    input: ProductUpdateInput,
    context: RequestSecurityContext,
  ) {
    assertCatalogueAdministrator(actor);
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`product:${id}`}, 0))`;
      const existing = await this.repository.product(id, false, transaction);
      if (existing === null) throw catalogResourceNotFound();
      const categoryId = input.categoryId ?? existing.category.id;
      const category = await this.repository.category(categoryId, false, transaction);
      if (category === null) throw catalogResourceNotFound();
      const nextActive = input.isActive ?? existing.isActive;
      if (nextActive && !category.isActive)
        throw catalogConflict("An active product requires an active category");
      const nextPrice = BigInt(input.priceKobo ?? existing.priceKobo);
      const nextCompare =
        input.compareAtPriceKobo === undefined
          ? existing.compareAtPriceKobo
          : input.compareAtPriceKobo === null
            ? null
            : BigInt(input.compareAtPriceKobo);
      if (nextCompare !== null && nextCompare < nextPrice)
        throw catalogConflict("Compare-at price must not be below the selling price");
      if (
        input.isActive === false &&
        existing.isActive &&
        (await transaction.inventoryReservation.count({
          where: { inventory: { productId: id }, status: "ACTIVE" },
        })) > 0
      ) {
        throw catalogConflict(
          "Release or consume active reservations before deactivating this product",
        );
      }
      const product = await this.repository.updateProduct(id, input, transaction);
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: input.isActive === undefined ? "UPDATE" : "STATUS_CHANGE",
        entityType: "PRODUCT",
        entityId: id,
        oldValues: {
          categoryId: existing.category.id,
          active: existing.isActive,
          priceKobo: existing.priceKobo.toString(),
        },
        newValues: {
          categoryId,
          active: product.isActive,
          priceKobo: product.priceKobo.toString(),
          changedFields: Object.keys(input).sort().join(","),
        },
        context,
      });
      return productView(product);
    });
  }

  async createCompatibility(
    actor: AuthenticatedActor,
    productId: string,
    input: CompatibilityCreateInput,
    context: RequestSecurityContext,
  ) {
    return this.productChildMutation(actor, productId, context, "CREATE", (transaction) =>
      this.repository.createCompatibility(productId, input, transaction),
    );
  }
  async updateCompatibility(
    actor: AuthenticatedActor,
    productId: string,
    id: string,
    input: CompatibilityUpdateInput,
    context: RequestSecurityContext,
  ) {
    return this.productChildMutation(actor, productId, context, "UPDATE", (transaction) =>
      this.repository.updateCompatibility(productId, id, input, transaction),
    );
  }
  async deleteCompatibility(
    actor: AuthenticatedActor,
    productId: string,
    id: string,
    context: RequestSecurityContext,
  ) {
    await this.productChildMutation(actor, productId, context, "DELETE", (transaction) =>
      this.repository.deleteCompatibility(productId, id, transaction),
    );
  }
  async createImage(
    actor: AuthenticatedActor,
    productId: string,
    input: ImageCreateInput,
    context: RequestSecurityContext,
  ) {
    return this.productChildMutation(actor, productId, context, "CREATE", (transaction) =>
      this.repository.createImage(productId, input, transaction),
    );
  }
  async updateImage(
    actor: AuthenticatedActor,
    productId: string,
    id: string,
    input: ImageUpdateInput,
    context: RequestSecurityContext,
  ) {
    return this.productChildMutation(actor, productId, context, "UPDATE", (transaction) =>
      this.repository.updateImage(productId, id, input, transaction),
    );
  }
  async deleteImage(
    actor: AuthenticatedActor,
    productId: string,
    id: string,
    context: RequestSecurityContext,
  ) {
    await this.productChildMutation(actor, productId, context, "DELETE", (transaction) =>
      this.repository.deleteImage(productId, id, transaction),
    );
  }

  private async productChildMutation<T>(
    actor: AuthenticatedActor,
    productId: string,
    context: RequestSecurityContext,
    action: "CREATE" | "UPDATE" | "DELETE",
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    assertCatalogueAdministrator(actor);
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`product:${productId}`}, 0))`;
      if ((await this.repository.product(productId, false, transaction)) === null)
        throw catalogResourceNotFound();
      const result = await operation(transaction);
      const childId =
        typeof result === "object" && result !== null && "id" in result
          ? String(result.id)
          : productId;
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action,
        entityType: "PRODUCT",
        entityId: productId,
        newValues: { childId },
        context,
      });
      return result;
    });
  }

  async favourites(actor: AuthenticatedActor, query: FavouriteListQuery) {
    assertCustomer(actor);
    const result = page(
      await this.repository.listFavourites(actor.userId, query),
      query.limit,
    );
    return {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        product: productView(item.product),
      })),
    };
  }
  async addFavourite(actor: AuthenticatedActor, productId: string) {
    assertCustomer(actor);
    return this.database.$transaction(async (transaction) => {
      if ((await this.repository.product(productId, true, transaction)) === null)
        throw catalogResourceNotFound();
      const favourite = await this.repository.addFavourite(
        actor.userId,
        productId,
        transaction,
      );
      if (favourite === null) throw catalogResourceNotFound();
      return { ...favourite, product: productView(favourite.product) };
    });
  }
  async removeFavourite(actor: AuthenticatedActor, productId: string) {
    assertCustomer(actor);
    if (
      !(await this.database.$transaction((transaction) =>
        this.repository.removeFavourite(actor.userId, productId, transaction),
      ))
    )
      throw catalogResourceNotFound();
  }

  async cart(actor: AuthenticatedActor) {
    assertCustomer(actor);
    return this.cartView(await this.repository.cart(actor.userId));
  }
  async setCartItem(actor: AuthenticatedActor, productId: string, quantity: number) {
    assertCustomer(actor);
    return this.database.$transaction(
      async (transaction) => {
        const product = await this.repository.product(productId, true, transaction);
        if (product === null) throw catalogResourceNotFound();
        const available = product.inventories.reduce(
          (total, item) => total + item.quantity - item.reserved,
          0,
        );
        if (available < quantity)
          throw catalogConflict("Requested quantity is not currently available");
        const cart = await this.repository.setCartItem(
          actor.userId,
          productId,
          quantity,
          transaction,
        );
        if (cart === null) throw catalogResourceNotFound();
        return this.cartView(cart);
      },
      { isolationLevel: "Serializable" },
    );
  }
  async removeCartItem(actor: AuthenticatedActor, productId: string) {
    assertCustomer(actor);
    if (
      !(await this.database.$transaction((transaction) =>
        this.repository.removeCartItem(actor.userId, productId, transaction),
      ))
    )
      throw catalogResourceNotFound();
  }
  async clearCart(actor: AuthenticatedActor) {
    assertCustomer(actor);
    await this.database.$transaction((transaction) =>
      this.repository.clearCart(actor.userId, transaction),
    );
  }

  private cartView(cart: Awaited<ReturnType<CatalogRepository["cart"]>>) {
    if (cart === null) return { items: [], subtotalKobo: "0" };
    let subtotal = 0n;
    const items = cart.items.map((item) => {
      const lineSubtotal = item.product.priceKobo * BigInt(item.quantity);
      subtotal += lineSubtotal;
      return {
        id: item.id,
        quantity: item.quantity,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        unitPriceKobo: item.product.priceKobo.toString(),
        lineSubtotalKobo: lineSubtotal.toString(),
        product: productView(item.product),
      };
    });
    return {
      id: cart.id,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
      items,
      subtotalKobo: subtotal.toString(),
    };
  }
}

export const catalogService = new CatalogService();
