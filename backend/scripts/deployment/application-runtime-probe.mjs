// Run from a built runtime's /app directory, with its synthetic test CA configured.
// Never starts a listener, worker loop, database connection or provider request.
import assert from "node:assert/strict";
import { accessSync } from "node:fs";
import net from "node:net";

net.Socket.prototype.connect = function () {
  throw new Error("Runtime import probe must not connect to a network");
};
Object.assign(process.env, {
  NODE_ENV: "production",
  DEPLOYMENT_ENV: "local",
  DB_HOST: "127.0.0.1",
  DB_PORT: "1",
  DB_NAME: "runtime_probe_test",
  DB_USER: "synthetic",
  DB_PASSWORD: "synthetic-runtime-probe",
  FRONTEND_URL: "https://frontend.example.test",
  LOG_LEVEL: "silent",
  PAYSTACK_MODE: "disabled",
  MONNIFY_MODE: "disabled",
  EMAIL_DELIVERY_ENABLED: "false",
  SMS_DELIVERY_ENABLED: "false",
  API_DOCS_ENABLED: "false",
});

const { app } = await import("./dist/app.js");
const { runGeneralWorker } = await import("./dist/workers/worker-runtime.js");
const { IdentityOutboxWorker } = await import("./dist/workers/outbox.worker.js");
assert.equal(typeof app, "function");
assert.equal(typeof runGeneralWorker, "function");
assert.equal(typeof IdentityOutboxWorker, "function");

const argon2 = await import("argon2");
const hash = await argon2.hash("synthetic-runtime-probe");
assert.equal(await argon2.verify(hash, "synthetic-runtime-probe"), true);
assert.equal(await argon2.verify(hash, "incorrect-synthetic-password"), false);
accessSync("assets/fonts/Quicksand-Regular.ttf");
accessSync("assets/fonts/Quicksand-Bold.ttf");
const { prisma } = await import("./dist/config/database.js");
await prisma.$disconnect();
console.log(JSON.stringify({ imports: 3, passwordHashVerified: true, fonts: 2 }));
