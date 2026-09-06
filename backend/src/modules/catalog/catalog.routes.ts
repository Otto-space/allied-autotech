import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import {
  requireAdministrator,
  requireCustomer,
} from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { validate } from "../../common/middleware/validate.js";
import { CatalogController } from "./catalog.controller.js";
import {
  adminCategoryListQuerySchema,
  adminProductListQuerySchema,
  cartItemBodySchema,
  catalogEmptyBodySchema,
  catalogEmptyQuerySchema,
  categoryCreateBodySchema,
  categoryListQuerySchema,
  categoryParamsSchema,
  categoryUpdateBodySchema,
  compatibilityCreateBodySchema,
  compatibilityParamsSchema,
  compatibilityUpdateBodySchema,
  favouriteListQuerySchema,
  imageCreateBodySchema,
  imageParamsSchema,
  imageUpdateBodySchema,
  productCreateBodySchema,
  productListQuerySchema,
  productParamsSchema,
  productUpdateBodySchema,
} from "./catalog.schemas.js";

export function createPublicCatalogRouter(): Router {
  const router = Router();
  const controller = new CatalogController();
  router.get(
    "/categories",
    validate({ query: categoryListQuerySchema }),
    controller.publicCategories,
  );
  router.get(
    "/categories/:categoryId",
    validate({ params: categoryParamsSchema, query: catalogEmptyQuerySchema }),
    controller.publicCategory,
  );
  router.get(
    "/products",
    validate({ query: productListQuerySchema }),
    controller.publicProducts,
  );
  router.get(
    "/products/:productId",
    validate({ params: productParamsSchema, query: catalogEmptyQuerySchema }),
    controller.publicProduct,
  );
  return router;
}

export function createCustomerCatalogRouter(): Router {
  const router = Router();
  const controller = new CatalogController();
  router.use(authenticate(), requireCustomer);
  router.get(
    "/favourites",
    validate({ query: favouriteListQuerySchema }),
    controller.favourites,
  );
  router.put(
    "/favourites/:productId",
    requireCsrf,
    validate({
      params: productParamsSchema,
      query: catalogEmptyQuerySchema,
      body: catalogEmptyBodySchema,
    }),
    controller.addFavourite,
  );
  router.delete(
    "/favourites/:productId",
    requireCsrf,
    validate({
      params: productParamsSchema,
      query: catalogEmptyQuerySchema,
      body: catalogEmptyBodySchema,
    }),
    controller.removeFavourite,
  );
  router.get("/cart", validate({ query: catalogEmptyQuerySchema }), controller.cart);
  router.put(
    "/cart/items/:productId",
    requireCsrf,
    validate({
      params: productParamsSchema,
      query: catalogEmptyQuerySchema,
      body: cartItemBodySchema,
    }),
    controller.setCartItem,
  );
  router.delete(
    "/cart/items/:productId",
    requireCsrf,
    validate({
      params: productParamsSchema,
      query: catalogEmptyQuerySchema,
      body: catalogEmptyBodySchema,
    }),
    controller.removeCartItem,
  );
  router.delete(
    "/cart",
    requireCsrf,
    validate({ query: catalogEmptyQuerySchema, body: catalogEmptyBodySchema }),
    controller.clearCart,
  );
  return router;
}

export function createAdminCatalogRouter(): Router {
  const router = Router();
  const controller = new CatalogController();
  router.use(authenticate(), requireAdministrator);
  router.get(
    "/categories",
    validate({ query: adminCategoryListQuerySchema }),
    controller.categories,
  );
  router.post(
    "/categories",
    requireCsrf,
    validate({ query: catalogEmptyQuerySchema, body: categoryCreateBodySchema }),
    controller.createCategory,
  );
  router.patch(
    "/categories/:categoryId",
    requireCsrf,
    validate({
      params: categoryParamsSchema,
      query: catalogEmptyQuerySchema,
      body: categoryUpdateBodySchema,
    }),
    controller.updateCategory,
  );
  router.get(
    "/products",
    validate({ query: adminProductListQuerySchema }),
    controller.products,
  );
  router.post(
    "/products",
    requireCsrf,
    validate({ query: catalogEmptyQuerySchema, body: productCreateBodySchema }),
    controller.createProduct,
  );
  router.patch(
    "/products/:productId",
    requireCsrf,
    validate({
      params: productParamsSchema,
      query: catalogEmptyQuerySchema,
      body: productUpdateBodySchema,
    }),
    controller.updateProduct,
  );
  router.post(
    "/products/:productId/compatibilities",
    requireCsrf,
    validate({
      params: productParamsSchema,
      query: catalogEmptyQuerySchema,
      body: compatibilityCreateBodySchema,
    }),
    controller.createCompatibility,
  );
  router.patch(
    "/products/:productId/compatibilities/:compatibilityId",
    requireCsrf,
    validate({
      params: compatibilityParamsSchema,
      query: catalogEmptyQuerySchema,
      body: compatibilityUpdateBodySchema,
    }),
    controller.updateCompatibility,
  );
  router.delete(
    "/products/:productId/compatibilities/:compatibilityId",
    requireCsrf,
    validate({
      params: compatibilityParamsSchema,
      query: catalogEmptyQuerySchema,
      body: catalogEmptyBodySchema,
    }),
    controller.deleteCompatibility,
  );
  router.post(
    "/products/:productId/images",
    requireCsrf,
    validate({
      params: productParamsSchema,
      query: catalogEmptyQuerySchema,
      body: imageCreateBodySchema,
    }),
    controller.createImage,
  );
  router.patch(
    "/products/:productId/images/:imageId",
    requireCsrf,
    validate({
      params: imageParamsSchema,
      query: catalogEmptyQuerySchema,
      body: imageUpdateBodySchema,
    }),
    controller.updateImage,
  );
  router.delete(
    "/products/:productId/images/:imageId",
    requireCsrf,
    validate({
      params: imageParamsSchema,
      query: catalogEmptyQuerySchema,
      body: catalogEmptyBodySchema,
    }),
    controller.deleteImage,
  );
  return router;
}
