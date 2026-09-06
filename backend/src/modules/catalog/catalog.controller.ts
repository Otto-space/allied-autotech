import type { Request, Response } from "express";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";
import { successResponse } from "../../common/http/api-response.js";
import { catalogService, type CatalogService } from "./catalog.service.js";
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

function validated<T>(response: Response, location: "body" | "params" | "query"): T {
  return response.locals.validated?.[location] as T;
}
function actor(request: Request): AuthenticatedActor {
  if (request.actor === undefined)
    throw new AppError({
      code: errorCodes.unauthorized,
      message: "Authentication is required",
      statusCode: 401,
    });
  return request.actor;
}
function context(request: Request): RequestSecurityContext {
  return {
    requestId: request.id as string,
    ipAddress: request.ip ?? null,
    userAgent: request.get("user-agent") ?? null,
  };
}
function params(response: Response): {
  productId: string;
  categoryId: string;
  compatibilityId: string;
  imageId: string;
} {
  return validated(response, "params");
}

export class CatalogController {
  constructor(private readonly service: CatalogService = catalogService) {}

  publicCategories = async (req: Request, res: Response) => {
    res
      .status(200)
      .json(
        successResponse(
          "Categories retrieved",
          req.id,
          await this.service.publicCategories(
            validated(res, "query") as CategoryListQuery,
          ),
        ),
      );
  };
  publicCategory = async (req: Request, res: Response) => {
    res
      .status(200)
      .json(
        successResponse(
          "Category retrieved",
          req.id,
          await this.service.publicCategory(params(res).categoryId),
        ),
      );
  };
  publicProducts = async (req: Request, res: Response) => {
    res
      .status(200)
      .json(
        successResponse(
          "Products retrieved",
          req.id,
          await this.service.publicProducts(validated(res, "query") as ProductListQuery),
        ),
      );
  };
  publicProduct = async (req: Request, res: Response) => {
    res
      .status(200)
      .json(
        successResponse(
          "Product retrieved",
          req.id,
          await this.service.publicProduct(params(res).productId),
        ),
      );
  };
  categories = async (req: Request, res: Response) => {
    res
      .status(200)
      .json(
        successResponse(
          "Categories retrieved",
          req.id,
          await this.service.categories(
            actor(req),
            validated(res, "query") as AdminCategoryListQuery,
          ),
        ),
      );
  };
  products = async (req: Request, res: Response) => {
    res
      .status(200)
      .json(
        successResponse(
          "Products retrieved",
          req.id,
          await this.service.products(
            actor(req),
            validated(res, "query") as AdminProductListQuery,
          ),
        ),
      );
  };
  createCategory = async (req: Request, res: Response) => {
    res
      .status(201)
      .json(
        successResponse(
          "Category created",
          req.id,
          await this.service.createCategory(
            actor(req),
            validated(res, "body") as CategoryCreateInput,
            context(req),
          ),
        ),
      );
  };
  updateCategory = async (req: Request, res: Response) => {
    res
      .status(200)
      .json(
        successResponse(
          "Category updated",
          req.id,
          await this.service.updateCategory(
            actor(req),
            params(res).categoryId,
            validated(res, "body") as CategoryUpdateInput,
            context(req),
          ),
        ),
      );
  };
  createProduct = async (req: Request, res: Response) => {
    res
      .status(201)
      .json(
        successResponse(
          "Product created",
          req.id,
          await this.service.createProduct(
            actor(req),
            validated(res, "body") as ProductCreateInput,
            context(req),
          ),
        ),
      );
  };
  updateProduct = async (req: Request, res: Response) => {
    res
      .status(200)
      .json(
        successResponse(
          "Product updated",
          req.id,
          await this.service.updateProduct(
            actor(req),
            params(res).productId,
            validated(res, "body") as ProductUpdateInput,
            context(req),
          ),
        ),
      );
  };
  createCompatibility = async (req: Request, res: Response) => {
    res
      .status(201)
      .json(
        successResponse(
          "Compatibility created",
          req.id,
          await this.service.createCompatibility(
            actor(req),
            params(res).productId,
            validated(res, "body") as CompatibilityCreateInput,
            context(req),
          ),
        ),
      );
  };
  updateCompatibility = async (req: Request, res: Response) => {
    const value = params(res);
    res
      .status(200)
      .json(
        successResponse(
          "Compatibility updated",
          req.id,
          await this.service.updateCompatibility(
            actor(req),
            value.productId,
            value.compatibilityId,
            validated(res, "body") as CompatibilityUpdateInput,
            context(req),
          ),
        ),
      );
  };
  deleteCompatibility = async (req: Request, res: Response) => {
    const value = params(res);
    await this.service.deleteCompatibility(
      actor(req),
      value.productId,
      value.compatibilityId,
      context(req),
    );
    res.status(200).json(successResponse("Compatibility deleted", req.id));
  };
  createImage = async (req: Request, res: Response) => {
    res
      .status(201)
      .json(
        successResponse(
          "Product image created",
          req.id,
          await this.service.createImage(
            actor(req),
            params(res).productId,
            validated(res, "body") as ImageCreateInput,
            context(req),
          ),
        ),
      );
  };
  updateImage = async (req: Request, res: Response) => {
    const value = params(res);
    res
      .status(200)
      .json(
        successResponse(
          "Product image updated",
          req.id,
          await this.service.updateImage(
            actor(req),
            value.productId,
            value.imageId,
            validated(res, "body") as ImageUpdateInput,
            context(req),
          ),
        ),
      );
  };
  deleteImage = async (req: Request, res: Response) => {
    const value = params(res);
    await this.service.deleteImage(
      actor(req),
      value.productId,
      value.imageId,
      context(req),
    );
    res.status(200).json(successResponse("Product image deleted", req.id));
  };
  favourites = async (req: Request, res: Response) => {
    res
      .status(200)
      .json(
        successResponse(
          "Favourites retrieved",
          req.id,
          await this.service.favourites(
            actor(req),
            validated(res, "query") as FavouriteListQuery,
          ),
        ),
      );
  };
  addFavourite = async (req: Request, res: Response) => {
    res
      .status(200)
      .json(
        successResponse(
          "Favourite saved",
          req.id,
          await this.service.addFavourite(actor(req), params(res).productId),
        ),
      );
  };
  removeFavourite = async (req: Request, res: Response) => {
    await this.service.removeFavourite(actor(req), params(res).productId);
    res.status(200).json(successResponse("Favourite removed", req.id));
  };
  cart = async (req: Request, res: Response) => {
    res
      .status(200)
      .json(
        successResponse("Cart retrieved", req.id, await this.service.cart(actor(req))),
      );
  };
  setCartItem = async (req: Request, res: Response) => {
    const input = validated<{ quantity: number }>(res, "body");
    res
      .status(200)
      .json(
        successResponse(
          "Cart updated",
          req.id,
          await this.service.setCartItem(
            actor(req),
            params(res).productId,
            input.quantity,
          ),
        ),
      );
  };
  removeCartItem = async (req: Request, res: Response) => {
    await this.service.removeCartItem(actor(req), params(res).productId);
    res.status(200).json(successResponse("Cart item removed", req.id));
  };
  clearCart = async (req: Request, res: Response) => {
    await this.service.clearCart(actor(req));
    res.status(200).json(successResponse("Cart cleared", req.id));
  };
}
