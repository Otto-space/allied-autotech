import pino, { type Logger } from "pino";

import { env } from "../../config/env.js";
import { sensitiveLogPaths } from "../security/redaction.js";
import { safeErrorAttributes } from "./safe-error.js";

export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  base: { service: env.SERVICE_NAME, environment: env.NODE_ENV },
  redact: { paths: [...sensitiveLogPaths], censor: "[REDACTED]" },
  serializers: { err: safeErrorAttributes },
  hooks: {
    logMethod(args, method) {
      if (args[0] instanceof Error) args[0] = { err: args[0] };
      // Pino otherwise copies an exception's message into msg before serialization.
      if (
        args[1] === undefined &&
        args[0] &&
        typeof args[0] === "object" &&
        "err" in args[0]
      )
        args[1] = "Operation failed";
      method.apply(this, args);
    },
  },
  ...(env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, singleLine: true },
        },
      }
    : {}),
});
