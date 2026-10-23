import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requireStaff } from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { createSensitiveRateLimit } from "../../common/middleware/rate-limits.js";
import { validate } from "../../common/middleware/validate.js";
import { successResponse } from "../../common/http/api-response.js";
import { FitmentService } from "./fitment.service.js";
import * as schemas from "./fitment.schemas.js";

const empty = z.object({}).strict();
const rulesQuery = z
  .object({
    productId: z.uuid().optional(),
    reviewStatus: z
      .enum(["DRAFT", "PENDING", "APPROVED", "REJECTED", "RETIRED"])
      .optional(),
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
const historyQuery = rulesQuery.pick({ cursor: true, limit: true });
export const fitmentRouteDefinitions = [
  [
    "get",
    "/public/fitment/makes",
    "makes",
    schemas.registryListQuerySchema.omit({ makeId: true }),
    empty,
  ],
  [
    "get",
    "/public/fitment/models",
    "models",
    schemas.registryListQuerySchema.required({ makeId: true }),
    empty,
  ],
  [
    "get",
    "/public/fitment/years",
    "years",
    z.object({ modelId: z.uuid() }).strict(),
    empty,
  ],
  [
    "get",
    "/public/fitment/products/:productId",
    "productFitment",
    schemas.selectionQuerySchema,
    schemas.fitmentProductParamsSchema,
  ],
  ["get", "/staff/fitment/access", "access", empty, empty],
  [
    "get",
    "/staff/fitment/products",
    "products",
    schemas.registryListQuerySchema.omit({ makeId: true }),
    empty,
  ],
  ["get", "/staff/fitment/rules", "rules", rulesQuery, empty],
  [
    "get",
    "/staff/fitment/products/:productId/rules/:ruleId/history",
    "history",
    historyQuery,
    schemas.fitmentParamsSchema,
  ],
  ["post", "/staff/fitment/makes", "createMake", schemas.makeWriteSchema, empty],
  ["post", "/staff/fitment/models", "createModel", schemas.modelWriteSchema, empty],
  [
    "post",
    "/staff/fitment/products/:productId/rules",
    "createRule",
    schemas.ruleWriteSchema,
    schemas.fitmentProductParamsSchema,
  ],
  [
    "put",
    "/staff/fitment/products/:productId/rules/:ruleId",
    "updateRule",
    schemas.ruleUpdateSchema,
    schemas.fitmentParamsSchema,
  ],
  [
    "post",
    "/staff/fitment/products/:productId/rules/:ruleId/transitions",
    "transition",
    schemas.ruleTransitionSchema,
    schemas.fitmentParamsSchema,
  ],
] as const;

export function createFitmentRouter() {
  const router = Router();
  const service = new FitmentService();
  for (const [method, path, action, schema, params] of fitmentRouteDefinitions) {
    const handler = async (req: Request, res: Response) => {
      const read = <T>(location: "query" | "body" | "params") =>
        res.locals.validated?.[location] as T;
      const { productId, ruleId } = read<{ productId: string; ruleId: string }>("params");
      const context = {
        requestId: String(req.id),
        ipAddress: req.ip ?? null,
        userAgent: req.get("user-agent") ?? null,
      };
      let result: unknown;
      switch (action) {
        case "makes":
          result = await service.makes(
            read<z.infer<typeof schemas.registryListQuerySchema>>("query"),
          );
          break;
        case "models":
          result = await service.models(
            read<z.infer<typeof schemas.registryListQuerySchema>>("query"),
          );
          break;
        case "years":
          result = await service.years(read<{ modelId: string }>("query").modelId);
          break;
        case "productFitment":
          result = await service.productFitment(
            productId,
            read<schemas.FitmentSelection>("query"),
          );
          break;
        case "access":
          result = await service.access(req.actor!);
          break;
        case "products":
          result = await service.products(
            req.actor!,
            read<z.infer<typeof schemas.registryListQuerySchema>>("query"),
          );
          break;
        case "rules":
          result = await service.rules(
            req.actor!,
            read<z.infer<typeof rulesQuery>>("query"),
          );
          break;
        case "history":
          result = await service.history(
            req.actor!,
            productId,
            ruleId,
            read<z.infer<typeof historyQuery>>("query"),
          );
          break;
        case "createMake":
          result = await service.createMake(
            req.actor!,
            read<z.infer<typeof schemas.makeWriteSchema>>("body").name,
            context,
          );
          break;
        case "createModel":
          result = await service.createModel(
            req.actor!,
            read<z.infer<typeof schemas.modelWriteSchema>>("body"),
            context,
          );
          break;
        case "createRule":
          result = await service.createRule(
            req.actor!,
            productId,
            read<schemas.RuleWrite>("body"),
            context,
          );
          break;
        case "updateRule":
          result = await service.updateRule(
            req.actor!,
            productId,
            ruleId,
            read<z.infer<typeof schemas.ruleUpdateSchema>>("body"),
            context,
          );
          break;
        case "transition":
          result = await service.transition(
            req.actor!,
            productId,
            ruleId,
            read<z.infer<typeof schemas.ruleTransitionSchema>>("body"),
            context,
          );
          break;
      }
      res.status(200).json(successResponse("Fitment request completed", req.id, result));
    };
    router[method](
      path,
      ...(path.startsWith("/staff/") ? [authenticate(), requireStaff] : []),
      ...(method === "get" ? [] : [requireCsrf, createSensitiveRateLimit(30)]),
      validate({
        params,
        query: method === "get" ? schema : empty,
        ...(method === "get" ? {} : { body: schema }),
      }),
      handler,
    );
  }
  return router;
}
