import { Router } from "express";

import {
  createReadinessHandler,
  getLiveness,
  type ReadinessCheck,
} from "./health.controller.js";

export function createHealthRouter(checkReadiness: ReadinessCheck): Router {
  const healthRouter = Router();
  const readinessHandler = createReadinessHandler(checkReadiness);

  healthRouter.get("/", readinessHandler);
  healthRouter.get("/live", getLiveness);
  healthRouter.get("/ready", readinessHandler);

  return healthRouter;
}
