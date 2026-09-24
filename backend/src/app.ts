import cors from "cors";
import cookieParser from "cookie-parser";
import express, { type Express, type Router } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { AppError } from "./common/errors/app-error.js";
import { withTimeout } from "./common/database/health.js";
import { errorCodes } from "./common/errors/error-codes.js";
import { errorHandler } from "./common/middleware/error-handler.js";
import { notFound } from "./common/middleware/not-found.js";
import { privateNoStore } from "./common/middleware/private-no-store.js";
import { createGlobalRateLimit } from "./common/middleware/rate-limits.js";
import { rawWebhookBody } from "./common/middleware/raw-webhook-body.js";
import { requestContext } from "./common/middleware/request-context.js";
import { logger } from "./common/observability/logger.js";
import { env } from "./config/env.js";
import { prisma } from "./config/database.js";
import { createApiRouter } from "./routes/index.js";

export interface CreateAppOptions {
  allowedOrigins?: readonly string[];
  apiRouter?: Router;
  checkReadiness?: () => Promise<void>;
  rateLimit?: number;
  rateWindowMs?: number;
  requestBodyLimit?: string;
  trustProxyHops?: number;
}

async function defaultReadinessCheck(): Promise<void> {
  await withTimeout(async () => {
    await prisma.$queryRaw`SELECT 1`;
  }, env.READINESS_TIMEOUT_MS);
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  const allowedOrigins = new Set(
    (options.allowedOrigins ?? env.FRONTEND_URL).map((origin) => new URL(origin).origin),
  );
  const trustProxyHops = options.trustProxyHops ?? env.TRUST_PROXY_HOPS;

  app.disable("x-powered-by");
  app.set(
    "trust proxy",
    options.trustProxyHops === undefined && env.TRUST_PROXY_CIDRS?.length
      ? env.TRUST_PROXY_CIDRS
      : trustProxyHops === 0
        ? false
        : trustProxyHops,
  );

  app.use(requestContext);
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(request) {
          return {
            id: request.id,
            method: request.method,
            path: new URL(request.url, "https://local.invalid").pathname,
          };
        },
        res(response) {
          return { statusCode: response.statusCode };
        },
      },
    }),
  );
  app.use(
    helmet(
      env.NODE_ENV === "production" ? undefined : { strictTransportSecurity: false },
    ),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (origin === undefined || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(
          new AppError({
            code: errorCodes.forbidden,
            message: "Origin is not allowed",
            statusCode: 403,
          }),
        );
      },
      credentials: true,
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Authorization",
        "Content-Type",
        "Idempotency-Key",
        "X-CSRF-Token",
        "X-Request-ID",
      ],
      exposedHeaders: ["X-Request-ID", "RateLimit", "RateLimit-Policy", "Retry-After"],
      maxAge: 600,
    }),
  );
  app.use(
    createGlobalRateLimit(
      options.rateLimit ?? env.GLOBAL_RATE_LIMIT,
      options.rateWindowMs ?? env.GLOBAL_RATE_WINDOW_MS,
    ),
  );
  app.use(cookieParser());

  app.use("/api/v1/webhooks/paystack", rawWebhookBody);
  app.use("/api/v1/webhooks/monnify", rawWebhookBody);
  app.use(
    express.json({
      limit: options.requestBodyLimit ?? env.REQUEST_BODY_LIMIT,
      strict: true,
    }),
  );

  app.use(
    "/api/v1",
    privateNoStore,
    options.apiRouter ??
      createApiRouter({
        checkReadiness: options.checkReadiness ?? defaultReadinessCheck,
      }),
  );

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
