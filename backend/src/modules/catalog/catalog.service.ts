import {
  decideFitment,
  selectionFromQuery,
  type PublishedRule,
} from "../fitment/fitment.engine.js";
import type { FitmentSelection } from "../fitment/fitment.schemas.js";
import { FitmentService } from "../fitment/fitment.service.js";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { prisma } from "../../config/database.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { catalogConflict, catalogResourceNotFound } from "./catalog.errors.js";
import { assertCatalogueAdministrator, assertCustomer } from "./catalog.policy.js";
import { CatalogRepository } from "./catalog.repository.js";
import {
  projectProductImage,
  type ProductImageRecord,
} from "./product-media.projection.js";
import { mediaError } from "../media/media.errors.js";
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
import { ProductDiscoveryRepository } from "./product-discovery.repository.js";
import type {
  ProductDiscoveryQuery,
  ProductFacetQuery,
} from "./product-discovery.schemas.js";

interface InventoryAvailability {
  quantity: number;
  reserved: number;
  branch: { id: string; code: string; name: string };
}

function productView<
  T extends {
    id: string;
    images: ProductImageRecord[];
    priceKobo: bigint;
    compareAtPriceKobo: bigint | null;
    inventories: InventoryAvailability[];
    compatibilities: (PublishedRule & {
      make: string;
      model: string | null;
      notes: string | null;
    })[];
  },
>(product: T, admin = false, selection?: FitmentSelection) {
  const { inventories, ...safe } = product;
  return {
    ...safe,
    ...(selection ? { fitment: decideFitment(product.compatibilities, selection) } : {}),
    compatibilities: admin
      ? product.compatibilities.filter((rule) => rule.reviewStatus !== "RETIRED")
      : product.compatibilities
          .filter((rule) => rule.reviewStatus === "APPROVED" && rule.effect === "INCLUDE")
          .map((rule) => ({
            id: rule.id,
            make: rule.make,
            model: rule.model,
            yearFrom: rule.yearFrom,
            yearTo: rule.yearTo,
            notes: rule.notes,
            scope: rule.scope,
            requiredQualifiers: rule.requiredQualifiers,
            ...Object.fromEntries(
              [
                "trim",
                "engineCode",
                "market",
                "position",
                "brakeSystem",
                "brakeDiameterMm",
                "bodyType",
                "transmission",
                "generation",
                "chassisCode",
              ].map((key) => [key, rule[key as keyof typeof rule]]),
            ),
          })),
    images: product.images.map((image) => projectProductImage(image, product.id, admin)),
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
    images: ProductImageRecord[];
    id: string;
    priceKobo: bigint;
    compareAtPriceKobo: bigint | null;
    inventories: InventoryAvailability[];
    compatibilities: (PublishedRule & {
      make: string;
      model: string | null;
      notes: string | null;
    })[];
  },
>(rows: T[], limit: number, admin = false, selection?: FitmentSelection) {
  const result = page(rows, limit);
  return {
    ...result,
    items: result.items.map((product) => productView(product, admin, selection)),
  };
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
    const selection = selectionFromQuery(query);
    if (selection) await new FitmentService(this.database).validateSelection(selection);
    return productPage(
      await this.repository.listProducts(query, true),
      query.limit,
      false,
      selection,
    );
  }
  async publicDiscovery(query: ProductDiscoveryQuery) {
    const selection = selectionFromQuery(query);
    if (selection) await new FitmentService(this.database).validateSelection(selection);
    const result = await new ProductDiscoveryRepository(this.database).products(query);
    return {
      ...result,
      items: result.items.map((product) => productView(product, false, selection)),
    };
  }
  publicFacets(query: ProductFacetQuery) {
    return new ProductDiscoveryRepository(this.database).facets(query);
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
  async category(actor: AuthenticatedActor, id: string) {
    assertCatalogueAdministrator(actor);
    const category = await this.repository.category(id, false);
    if (category === null) throw catalogResourceNotFound();
    return category;
  }
  async products(actor: AuthenticatedActor, query: AdminProductListQuery) {
    assertCatalogueAdministrator(actor);
    return productPage(
      await this.repository.listProducts(query, false),
      query.limit,
      true,
    );
  }

  async product(actor: AuthenticatedActor, id: string) {
    assertCatalogueAdministrator(actor);
    const product = await this.repository.product(id, false);
    if (product === null) throw catalogResourceNotFound();
    return productView(product, true);
  }

  // All hierarchy writers share one lock. This also serializes product eligibility
  // checks with ancestor moves/deactivation, so concurrent requests cannot create cycles.
  private async lockCategoryHierarchy(transaction: Prisma.TransactionClient) {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('catalog-category-hierarchy', 0))`;
  }

  private async assertCategoryParent(
    transaction: Prisma.TransactionClient,
    parentId: string | null,
    isActive: boolean,
    categoryId?: string,
  ) {
    if (parentId === null) return;
    if (parentId === categoryId)
      throw catalogConflict("A category cannot be its own parent");
    const parent = await this.repository.category(parentId, false, transaction);
    if (!parent) throw catalogResourceNotFound();
    if (parent.parentId !== null)
      throw catalogConflict(
        "Choose a top-level parent category. Categories support one level of subcategories.",
      );
    if (isActive && !parent.isActive)
      throw catalogConflict("An active subcategory requires an active parent category");
    if (
      categoryId &&
      (await transaction.category.count({ where: { parentId: categoryId } }))
    )
      throw catalogConflict(
        "Move this category's subcategories before making it a subcategory",
      );
  }

  private async assertProductCategoryActive(
    transaction: Prisma.TransactionClient,
    category: { isActive: boolean; parentId: string | null },
  ) {
    if (
      !category.isActive ||
      (category.parentId !== null &&
        !(await this.repository.category(category.parentId, false, transaction))
          ?.isActive)
    )
      throw catalogConflict(
        "An active product requires an active category and parent category",
      );
  }

  async createCategory(
    actor: AuthenticatedActor,
    input: CategoryCreateInput,
    context: RequestSecurityContext,
  ) {
    assertCatalogueAdministrator(actor);
    return this.database.$transaction(async (transaction) => {
      await this.lockCategoryHierarchy(transaction);
      await this.assertCategoryParent(
        transaction,
        input.parentId ?? null,
        input.isActive,
      );
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
      await this.lockCategoryHierarchy(transaction);
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`category:${id}`}, 0))`;
      await transaction.$queryRaw`SELECT "id" FROM "Category" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const existing = await this.repository.category(id, false, transaction);
      if (existing === null) throw catalogResourceNotFound();
      if (
        input.expectedUpdatedAt !== undefined &&
        new Date(input.expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()
      ) {
        throw catalogConflict("This category has changed. Reload it before saving.");
      }
      await this.assertCategoryParent(
        transaction,
        input.parentId === undefined ? existing.parentId : input.parentId,
        input.isActive ?? existing.isActive,
        id,
      );
      if (
        input.isActive === false &&
        existing.isActive &&
        (await transaction.category.count({ where: { parentId: id, isActive: true } }))
      )
        throw catalogConflict(
          "Deactivate subcategories before deactivating their parent category",
        );
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
      const category = await this.repository.updateCategory(
        id,
        input,
        new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1)),
        transaction,
      );
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: input.isActive === undefined ? "UPDATE" : "STATUS_CHANGE",
        entityType: "PRODUCT",
        entityId: id,
        oldValues: { resourceType: "CATEGORY", active: existing.isActive },
        newValues: {
          resourceType: "CATEGORY",
          active: category.isActive,
          changedFields: Object.keys(input)
            .filter((key) => key !== "expectedUpdatedAt")
            .sort()
            .join(","),
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
      await this.lockCategoryHierarchy(transaction);
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`category:${input.categoryId}`}, 0))`;
      const category = await this.repository.category(
        input.categoryId,
        false,
        transaction,
      );
      if (category === null) throw catalogResourceNotFound();
      if (input.isActive) await this.assertProductCategoryActive(transaction, category);
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
      return productView(product, true);
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
      await this.lockCategoryHierarchy(transaction);
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`product:${id}`}, 0))`;
      // Serialize the observed timestamp with every database writer, including media.
      await transaction.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const existing = await this.repository.product(id, false, transaction);
      if (existing === null) throw catalogResourceNotFound();
      if (
        input.expectedUpdatedAt !== undefined &&
        new Date(input.expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()
      ) {
        throw catalogConflict("This product has changed. Reload it before saving.");
      }
      const categoryId = input.categoryId ?? existing.category.id;
      // Use the same category lock as creation/deactivation before checking eligibility.
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`category:${categoryId}`}, 0))`;
      const category = await this.repository.category(categoryId, false, transaction);
      if (category === null) throw catalogResourceNotFound();
      const nextActive = input.isActive ?? existing.isActive;
      if (nextActive) await this.assertProductCategoryActive(transaction, category);
      if (
        input.productType !== undefined &&
        input.productType !== existing.productType &&
        (await transaction.productCompatibility.count({
          where: { productId: id, reviewStatus: "APPROVED" },
        }))
      )
        throw catalogConflict(
          "Retire approved fitment rules before changing the product type, then submit the updated fitment for a new review",
        );
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
      // A second save in the same millisecond must still invalidate the first snapshot.
      const updatedAt = new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1));
      const product = await this.repository.updateProduct(
        id,
        input,
        updatedAt,
        transaction,
      );
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
          changedFields: Object.keys(input)
            .filter((key) => key !== "expectedUpdatedAt")
            .sort()
            .join(","),
        },
        context,
      });
      return productView(product, true);
    });
  }

  private async legacyCompatibilityHistory(
    transaction: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    row: Awaited<ReturnType<CatalogRepository["createCompatibility"]>>,
    action: string,
  ) {
    await transaction.productCompatibilityHistory.create({
      data: {
        compatibilityId: row.id,
        actorUserId: actor.userId,
        action,
        version: row.version,
        snapshot: JSON.parse(JSON.stringify(row)) as Prisma.InputJsonObject,
      },
    });
  }
  async createCompatibility(
    actor: AuthenticatedActor,
    productId: string,
    input: CompatibilityCreateInput,
    context: RequestSecurityContext,
  ) {
    return this.productChildMutation(
      actor,
      productId,
      context,
      "CREATE",
      async (transaction) => {
        const created = await this.repository.createCompatibility(
          productId,
          input,
          transaction,
        );
        const row = await transaction.productCompatibility.update({
          where: { id: created.id },
          data: { createdByUserId: actor.userId, updatedByUserId: actor.userId },
        });
        await this.legacyCompatibilityHistory(
          transaction,
          actor,
          row,
          "CREATE_LEGACY_DRAFT",
        );
        return row;
      },
    );
  }
  async updateCompatibility(
    actor: AuthenticatedActor,
    productId: string,
    id: string,
    input: CompatibilityUpdateInput,
    context: RequestSecurityContext,
  ) {
    return this.productChildMutation(
      actor,
      productId,
      context,
      "UPDATE",
      async (transaction) => {
        const existing = await transaction.productCompatibility.findFirst({
          where: { id, productId },
        });
        if (!existing) throw catalogResourceNotFound();
        if (
          input.expectedVersion !== undefined &&
          existing.version !== input.expectedVersion
        )
          throw catalogConflict(
            "This compatibility record changed. Reload it before saving.",
          );
        if (existing.vehicleModelId !== null || existing.reviewStatus !== "DRAFT")
          throw catalogConflict(
            "Use the reviewed fitment workspace to change or retire this rule",
          );
        const yearFrom =
          input.yearFrom === undefined ? existing.yearFrom : input.yearFrom;
        const yearTo = input.yearTo === undefined ? existing.yearTo : input.yearTo;
        if (yearFrom !== null && yearTo !== null && yearFrom > yearTo)
          throw catalogConflict("Compatibility end year must not precede its start year");
        if (
          !(await transaction.productCompatibilityHistory.findFirst({
            where: { compatibilityId: id },
          }))
        )
          await this.legacyCompatibilityHistory(
            transaction,
            actor,
            existing,
            "LEGACY_CAPTURE",
          );
        await this.repository.updateCompatibility(productId, id, input, transaction);
        const row = await transaction.productCompatibility.update({
          where: { id },
          data: { updatedByUserId: actor.userId, version: { increment: 1 } },
        });
        await this.legacyCompatibilityHistory(
          transaction,
          actor,
          row,
          "EDIT_LEGACY_DRAFT",
        );
        return row;
      },
    );
  }
  async deleteCompatibility(
    actor: AuthenticatedActor,
    productId: string,
    id: string,
    context: RequestSecurityContext,
    expectedVersion?: number,
  ) {
    await this.productChildMutation(
      actor,
      productId,
      context,
      "DELETE",
      async (transaction) => {
        const existing = await transaction.productCompatibility.findFirst({
          where: { id, productId },
        });
        if (!existing) throw catalogResourceNotFound();
        if (expectedVersion !== undefined && existing.version !== expectedVersion)
          throw catalogConflict(
            "This compatibility record changed. Reload it before retiring.",
          );
        if (existing.vehicleModelId !== null || existing.reviewStatus !== "DRAFT")
          throw catalogConflict("Use the reviewed fitment workspace to retire this rule");
        if (
          !(await transaction.productCompatibilityHistory.findFirst({
            where: { compatibilityId: id },
          }))
        )
          await this.legacyCompatibilityHistory(
            transaction,
            actor,
            existing,
            "LEGACY_CAPTURE",
          );
        const row = await transaction.productCompatibility.update({
          where: { id },
          data: {
            reviewStatus: "RETIRED",
            fingerprint: null,
            updatedByUserId: actor.userId,
            version: { increment: 1 },
          },
        });
        await this.legacyCompatibilityHistory(
          transaction,
          actor,
          row,
          "RETIRE_LEGACY_DRAFT",
        );
        return row;
      },
    );
  }
  async createImage(
    actor: AuthenticatedActor,
    productId: string,
    input: ImageCreateInput,
    context: RequestSecurityContext,
  ) {
    return this.productChildMutation(
      actor,
      productId,
      context,
      "CREATE",
      (transaction) => this.repository.createImage(productId, input, transaction),
      true,
      input.expectedVersion,
    );
  }
  async updateImage(
    actor: AuthenticatedActor,
    productId: string,
    id: string,
    input: ImageUpdateInput,
    context: RequestSecurityContext,
  ) {
    return this.productChildMutation(
      actor,
      productId,
      context,
      "UPDATE",
      (transaction) => this.repository.updateImage(productId, id, input, transaction),
      true,
      input.expectedVersion,
    );
  }
  async deleteImage(
    actor: AuthenticatedActor,
    productId: string,
    id: string,
    context: RequestSecurityContext,
    expectedVersion?: number,
  ) {
    await this.productChildMutation(
      actor,
      productId,
      context,
      "DELETE",
      (transaction) => this.repository.deleteImage(productId, id, transaction),
      true,
      expectedVersion,
    );
  }

  private async productChildMutation<T>(
    actor: AuthenticatedActor,
    productId: string,
    context: RequestSecurityContext,
    action: "CREATE" | "UPDATE" | "DELETE",
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
    imageMutation = false,
    expectedVersion?: number,
  ): Promise<T> {
    assertCatalogueAdministrator(actor);
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`product:${productId}`}, 0))`;
      const product = await this.repository.product(productId, false, transaction);
      if (product === null) throw catalogResourceNotFound();
      if (
        imageMutation &&
        expectedVersion !== undefined &&
        product.mediaVersion !== expectedVersion
      )
        throw mediaError("STALE_VERSION", 409);
      const result = await operation(transaction);
      if (imageMutation)
        await transaction.product.update({
          where: { id: productId },
          data: { mediaVersion: { increment: 1 } },
        });
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
