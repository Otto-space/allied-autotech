import "dotenv/config";

import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { z } from "zod";

const envFilePath = fileURLToPath(
  new URL("../../.env", import.meta.url),
);

const dotenvResult = config({
  path: envFilePath,
});

if (dotenvResult.error) {
  console.error("Unable to load the .env file");
  process.exit(1);
}

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65_535)
    .default(5000),

  FRONTEND_URL: z
    .string()
    .min(1, "FRONTEND_URL is required")
    .transform((value) =>
      value.split(",").map((origin) => origin.trim()),
    )
    .pipe(z.array(z.url()).min(1)),

  DB_HOST: z
    .string()
    .trim()
    .min(1, "DB_HOST is required"),

  DB_PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65_535),

  DB_NAME: z
    .string()
    .trim()
    .min(1, "DB_NAME is required"),

  DB_USER: z
    .string()
    .trim()
    .min(1, "DB_USER is required"),

  DB_PASSWORD: z
    .string()
    .min(1, "DB_PASSWORD is required"),
});

const environment = environmentSchema.safeParse(process.env);

if (!environment.success) {
  console.error(
    "Invalid server environment configuration",
    environment.error.issues,
  );

  process.exit(1);
}

export const env = environment.data;