import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requireAdministrator } from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { createSensitiveRateLimit } from "../../common/middleware/rate-limits.js";
import { validate } from "../../common/middleware/validate.js";
import { successResponse } from "../../common/http/api-response.js";
import { mediaUploadSchema, type MediaUploadInput } from "../media/media.schemas.js";
import {
  productParamsSchema,
  imageParamsSchema,
  catalogEmptyQuerySchema as query,
} from "./catalog.schemas.js";
import {
  productImageConfirmSchema,
  productImageOrderSchema,
  type ProductImageOrder,
  type ProductImageConfirm,
} from "./product-media.schemas.js";
import { ProductMediaService } from "./product-media.service.js";
const context = (req: Request) => ({
  requestId: String(req.id),
  ipAddress: req.ip ?? null,
  userAgent: req.get("user-agent") ?? null,
});
const ids = (res: Response) =>
  res.locals.validated?.["params"] as { productId: string; imageId: string };
const body = <T>(res: Response) => res.locals.validated?.["body"] as T;
function sendImage(res: Response, result: { mimeType: string; bytes: Buffer }) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.type(result.mimeType).send(result.bytes);
}
export function createPublicProductMediaRouter(service = new ProductMediaService()) {
  const router = Router();
  router.get(
    "/products/images/:imageId",
    validate({ params: z.object({ imageId: z.uuid() }).strict(), query }),
    async (_req, res) => sendImage(res, await service.read(ids(res).imageId)),
  );
  return router;
}
export function createProductMediaRouter(service = new ProductMediaService()) {
  const router = Router();
  router.use(authenticate(), requireAdministrator);
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    next();
  });
  router.get(
    "/products/:productId/images/:imageId/content",
    validate({ params: imageParamsSchema, query }),
    async (req, res) =>
      sendImage(
        res,
        await service.read(ids(res).imageId, {
          actor: req.actor!,
          productId: ids(res).productId,
        }),
      ),
  );
  router.post(
    "/products/:productId/images/reorder",
    requireCsrf,
    validate({ params: productParamsSchema, query, body: productImageOrderSchema }),
    async (req, res) =>
      res.json(
        successResponse(
          "Product image order saved",
          req.id,
          await service.reorder(
            req.actor!,
            ids(res).productId,
            body<ProductImageOrder>(res),
            context(req),
          ),
        ),
      ),
  );
  router.post(
    "/products/:productId/assets/upload",
    requireCsrf,
    createSensitiveRateLimit(20, 60000),
    validate({ params: productParamsSchema, query, body: mediaUploadSchema }),
    async (req, res) => {
      res.json(
        successResponse(
          "Product image upload prepared",
          req.id,
          await service.prepare(
            req.actor!,
            ids(res).productId,
            body<MediaUploadInput>(res),
            context(req),
          ),
        ),
      );
    },
  );
  router.post(
    "/products/:productId/images/confirm",
    requireCsrf,
    createSensitiveRateLimit(20, 60000),
    validate({ params: productParamsSchema, query, body: productImageConfirmSchema }),
    async (req, res) => {
      res.json(
        successResponse(
          "Product image attached",
          req.id,
          await service.confirm(
            req.actor!,
            ids(res).productId,
            body<ProductImageConfirm>(res),
            context(req),
          ),
        ),
      );
    },
  );
  return router;
}
