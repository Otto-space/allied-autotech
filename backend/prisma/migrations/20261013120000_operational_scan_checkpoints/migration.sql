-- Durable keyset positions for bounded recurring operational scans. No business
-- record or financial state changes; empty checkpoints begin at the oldest row.
CREATE TABLE "WorkerScanCheckpoint" (
  "name" VARCHAR(100) NOT NULL,
  "afterCreatedAt" TIMESTAMP(3),
  "afterId" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkerScanCheckpoint_pkey" PRIMARY KEY ("name"),
  CONSTRAINT "WorkerScanCheckpoint_position_pair" CHECK (("afterCreatedAt" IS NULL) = ("afterId" IS NULL)),
  CONSTRAINT "WorkerScanCheckpoint_version_positive" CHECK ("version" > 0)
);
