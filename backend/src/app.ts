import cors from "cors";

import express, {
  type ErrorRequestHandler,
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";

import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { prisma } from "./config/database.js";
import { env } from "./config/env.js";

interface ApiResponse {
  success: boolean;
  message: string;
}

class CorsError extends Error {
  constructor() {
    super("Origin is not allowed");
    this.name = "CorsError";
  }
}

const allowedOrigins: Set<string> = new Set(
  env.FRONTEND_URL.map((origin: string): string => new URL(origin).origin),
);

const app: Express = express();

app.disable("x-powered-by");

app.use(
  helmet({
    // Avoid persisting HTTPS-only behaviour during local HTTP development.
    ...(env.NODE_ENV === "production"
      ? {}
      : { strictTransportSecurity: false }),
  }),
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests",
    } satisfies ApiResponse,
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      // Requests without Origin include server-to-server requests
      // and some health checks.
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new CorsError());
    },

    credentials: true,

    methods: [
      "GET",
      "HEAD",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-CSRF-Token",
    ],

    maxAge: 600,
  }),
);

app.use(
  express.json({
    limit: "100kb",
    strict: true,
  }),
);

app.get(
  "/api/v1/health",
  async (
    _req: Request,
    res: Response<ApiResponse>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await prisma.$queryRaw`SELECT 1`;

      res.status(200).json({
        success: true,
        message: "Allied AutoTech API is healthy",
      });
    } catch (error) {
      next(error);
    }
  },
);

app.use(
  (_req: Request, res: Response<ApiResponse>): void => {
    res.status(404).json({
      success: false,
      message: "Resource not found",
    });
  },
);

const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  _next,
): void => {
  if (error instanceof CorsError) {
    res.status(403).json({
      success: false,
      message: "Origin is not allowed",
    });

    return;
  }

  if (
    error instanceof SyntaxError &&
    "status" in error &&
    error.status === 400
  ) {
    res.status(400).json({
      success: false,
      message: "Invalid JSON request body",
    });

    return;
  }

  console.error("Unhandled request error", error);

  res.status(500).json({
    success: false,
    message:
      env.NODE_ENV === "production"
        ? "Internal server error"
        : "Request failed",
  });
};

app.use(errorHandler);

export { app };