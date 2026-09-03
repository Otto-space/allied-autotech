import { app } from "./app.js";
import { logger } from "./common/observability/logger.js";
import { prisma } from "./config/database.js";
import { env } from "./config/env.js";

async function startServer(): Promise<void> {
  try {
    await prisma.$connect();

    const server = app.listen(env.PORT, (): void => {
      logger.info({ port: env.PORT }, "API started");
    });

    server.requestTimeout = 30_000;
    server.headersTimeout = 35_000;
    server.keepAliveTimeout = 5_000;

    server.on("clientError", (error, socket): void => {
      logger.warn({ err: error }, "Rejected malformed HTTP connection");

      if (socket.writable) {
        socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
      }
    });

    server.on("error", (error): void => {
      logger.error({ err: error }, "HTTP server error");
    });

    let isShuttingDown = false;

    const shutdown = async (signal: string): Promise<void> => {
      if (isShuttingDown) {
        return;
      }

      isShuttingDown = true;

      logger.info({ signal }, "Shutting down gracefully");

      const forcedShutdownTimer = setTimeout(() => {
        logger.error("Graceful shutdown timed out");
        server.closeAllConnections();
        process.exit(1);
      }, 10_000);

      forcedShutdownTimer.unref();

      server.close(async (error: Error | undefined): Promise<void> => {
        try {
          await prisma.$disconnect();

          if (error) {
            logger.error({ err: error }, "HTTP server shutdown failed");
            process.exit(1);
          }

          logger.info("Server shut down successfully");
          process.exit(0);
        } catch (disconnectError: unknown) {
          logger.error({ err: disconnectError }, "Database disconnection failed");

          process.exit(1);
        }
      });
    };

    process.on("SIGTERM", () => {
      void shutdown("SIGTERM");
    });

    process.on("SIGINT", () => {
      void shutdown("SIGINT");
    });
  } catch (error) {
    logger.fatal({ err: error }, "Server startup failed");

    await prisma.$disconnect().catch(() => undefined);

    process.exit(1);
  }
}

await startServer();
