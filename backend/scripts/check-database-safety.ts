import { checkDatabase } from "./lib/database-safety.js";

await checkDatabase();
process.stdout.write(
  "Database history and Prisma schema are compatible. No database changes were made.\n",
);
