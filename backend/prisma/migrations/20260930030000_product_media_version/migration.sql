-- Additive concurrency counter; legacy hosted-image clients may omit it.
ALTER TABLE "Product" ADD COLUMN "mediaVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD CONSTRAINT "Product_mediaVersion_nonnegative" CHECK ("mediaVersion" >= 0);
