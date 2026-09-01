import { app } from "./app.js";
import { prisma } from "./config/database.js";
import { env } from "./config/env.js";

async function startServer(): Promise<void> {
  try {
    await prisma.$connect();

    const server = app.listen(env.PORT, (): void => {
      console.log(`API running on port ${env.PORT}`);
    });

    server.requestTimeout = 30_000;
    server.headersTimeout = 35_000;
    server.keepAliveTimeout = 5_000;

    let isShuttingDown = false;

    const shutdown = async (signal: string): Promise<void> => {
      if (isShuttingDown) {
        return;
      }

      isShuttingDown = true;

      console.log(`${signal} received. Shutting down gracefully.`);

      const forcedShutdownTimer = setTimeout(() => {
        console.error("Graceful shutdown timed out");
        process.exit(1);
      }, 10_000);

      forcedShutdownTimer.unref();

      server.close(async (error: Error | undefined): Promise<void> => {
        try {
          await prisma.$disconnect();

          if (error) {
            console.error("HTTP server shutdown failed", error);
            process.exit(1);
          }

          console.log("Server shut down successfully");
          process.exit(0);
        } catch (disconnectError: unknown) {
          console.error(
            "Database disconnection failed",
            disconnectError,
          );

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
    console.error("Server startup failed", error);

    await prisma.$disconnect().catch(() => undefined);

    process.exit(1);
  }
}

await startServer();