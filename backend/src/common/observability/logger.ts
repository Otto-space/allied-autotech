import pino, { type Logger } from "pino";

import { env } from "../../config/env.js";
import { sensitiveLogPaths } from "../security/redaction.js";

export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "allied-autotech-api", environment: env.NODE_ENV },
  redact: { paths: [...sensitiveLogPaths], censor: "[REDACTED]" },
  ...(env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, singleLine: true },
        },
      }
    : {}),
});
