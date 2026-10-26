import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../common/middleware/authenticate.js";
import { validate } from "../../common/middleware/validate.js";
import { successResponse } from "../../common/http/api-response.js";
import {
  currentLearningAccess,
  learningCatalogue,
  learningItem,
  publicLearningAccess,
} from "./learning.service.js";
import { learningParams, learningQuery } from "./learning.schemas.js";
export function createLearningRouter() {
  const router = Router();
  for (const prefix of ["/public/learning", "/learning"]) {
    const auth = prefix === "/learning" ? [authenticate()] : [];
    for (const kind of ["catalogue", "articles", "guides", "scenarios"] as const) {
      router.get(
        prefix + "/" + kind + (kind === "catalogue" ? "" : "/:id"),
        ...auth,
        validate({
          query: kind === "catalogue" ? learningQuery : z.strictObject({}),
          params: kind === "catalogue" ? z.strictObject({}) : learningParams,
        }),
        async (req, res, next) => {
          try {
            res.setHeader("Cache-Control", "private, no-store");
            res.vary("Cookie");
            const access =
              prefix === "/learning"
                ? await currentLearningAccess(req.actor!)
                : publicLearningAccess;
            const data =
              kind === "catalogue"
                ? learningCatalogue(access, learningQuery.parse(req.query).q)
                : learningItem(access, kind, learningParams.parse(req.params).id);
            res.json(successResponse("Eligible learning content", req.id, data));
          } catch (error) {
            next(error);
          }
        },
      );
    }
  }
  return router;
}
