import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requireCustomer } from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { createSensitiveRateLimit } from "../../common/middleware/rate-limits.js";
import { validate } from "../../common/middleware/validate.js";
import { successResponse } from "../../common/http/api-response.js";
import { ProfilePhotoService } from "./profile-photo.service.js";
import {
  mediaConfirmSchema,
  mediaUploadSchema,
  mediaVersionSchema,
  type MediaConfirmInput,
  type MediaUploadInput,
} from "../media/media.schemas.js";
import { customerEmptyQuerySchema } from "./customers.schemas.js";

const context = (req: Request) => ({
  requestId: String(req.id),
  ipAddress: req.ip ?? null,
  userAgent: req.get("user-agent") ?? null,
});
const body = <T>(res: Response) => res.locals.validated?.["body"] as T;
export function createProfilePhotoRouter(service = new ProfilePhotoService()) {
  const router = Router();
  router.use(authenticate(), requireCustomer);
  router.post(
    "/profile/photo/upload",
    requireCsrf,
    createSensitiveRateLimit(20, 60_000),
    validate({ body: mediaUploadSchema, query: customerEmptyQuerySchema }),
    async (req, res) => {
      res.setHeader("Cache-Control", "private, no-store");
      res.json(
        successResponse(
          "Photo upload prepared",
          req.id,
          await service.prepare(req.actor!, body<MediaUploadInput>(res), context(req)),
        ),
      );
    },
  );
  router.put(
    "/profile/photo",
    requireCsrf,
    createSensitiveRateLimit(20, 60_000),
    validate({ body: mediaConfirmSchema, query: customerEmptyQuerySchema }),
    async (req, res) => {
      res.json(
        successResponse(
          "Profile photo saved",
          req.id,
          await service.confirm(req.actor!, body<MediaConfirmInput>(res), context(req)),
        ),
      );
    },
  );
  router.delete(
    "/profile/photo",
    requireCsrf,
    validate({ body: mediaVersionSchema, query: customerEmptyQuerySchema }),
    async (req, res) => {
      res.json(
        successResponse(
          "Profile photo removed",
          req.id,
          await service.remove(
            req.actor!,
            body<{ expectedVersion: number }>(res).expectedVersion,
            context(req),
          ),
        ),
      );
    },
  );
  router.get(
    "/media/images/:imageId",
    validate({
      params: z.object({ imageId: z.uuid() }).strict(),
      query: customerEmptyQuerySchema,
    }),
    async (req, res) => {
      const params = res.locals.validated?.["params"] as { imageId: string };
      const { imageId } = params;
      const result = await service.read(req.actor!, imageId);
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.type(result.mimeType).send(result.bytes);
    },
  );
  return router;
}
