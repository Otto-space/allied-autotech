/*
  Warnings:

  - You are about to drop the column `quotedPrice` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `mileage` on the `CustomerVehicle` table. All the data in the column will be lost.
  - You are about to drop the column `vehicleId` on the `Enquiry` table. All the data in the column will be lost.
  - You are about to drop the column `requestedAt` on the `InspectionRequest` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledAt` on the `InspectionRequest` table. All the data in the column will be lost.
  - You are about to drop the column `vehicleId` on the `InspectionRequest` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `InventoryTransaction` table. All the data in the column will be lost.
  - You are about to drop the column `subtotal` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `tax` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `total` on the `Invoice` table. All the data in the column will be lost.
  - You are about to alter the column `invoiceNumber` on the `Invoice` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to drop the column `deliveryFee` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `discountAmount` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `subtotal` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `total` on the `Order` table. All the data in the column will be lost.
  - You are about to alter the column `orderNumber` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(40)`.
  - You are about to drop the column `subtotal` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `unitPrice` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `amount` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `failureReason` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `gateway` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `gatewayResponse` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `gatewayTransactionId` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `paidAt` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `reference` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `verifiedAt` on the `Payment` table. All the data in the column will be lost.
  - The `status` column on the `Payment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `eventId` on the `PaymentWebhookEvent` table. All the data in the column will be lost.
  - You are about to drop the column `payload` on the `PaymentWebhookEvent` table. All the data in the column will be lost.
  - You are about to drop the column `paymentId` on the `PaymentWebhookEvent` table. All the data in the column will be lost.
  - You are about to drop the column `processingError` on the `PaymentWebhookEvent` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `discountValue` on the `Promotion` table. All the data in the column will be lost.
  - You are about to drop the column `maximumDiscountAmount` on the `Promotion` table. All the data in the column will be lost.
  - You are about to drop the column `minimumOrderAmount` on the `Promotion` table. All the data in the column will be lost.
  - You are about to drop the column `discountAmount` on the `PromotionUsage` table. All the data in the column will be lost.
  - You are about to drop the column `discountValueSnapshot` on the `PromotionUsage` table. All the data in the column will be lost.
  - You are about to drop the column `vehicleId` on the `SavedVehicle` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Service` table. All the data in the column will be lost.
  - You are about to drop the column `bodyType` on the `VehicleListing` table. All the data in the column will be lost.
  - You are about to drop the column `color` on the `VehicleListing` table. All the data in the column will be lost.
  - You are about to drop the column `condition` on the `VehicleListing` table. All the data in the column will be lost.
  - You are about to drop the column `doors` on the `VehicleListing` table. All the data in the column will be lost.
  - You are about to drop the column `driveType` on the `VehicleListing` table. All the data in the column will be lost.
  - You are about to drop the column `engineSize` on the `VehicleListing` table. All the data in the column will be lost.
  - You are about to drop the column `fuelType` on the `VehicleListing` table. All the data in the column will be lost.
  - You are about to drop the column `make` on the `VehicleListing` table. All the data in the column will be lost.
  - You are about to drop the column `mileage` on the `VehicleListing` table. All the data in the column will be lost.
  - You are about to drop the column `model` on the `VehicleListing` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `VehicleListing` table. All the data in the column will be lost.
  - You are about to drop the column `registrationNumber` on the `VehicleListing` table. All the data in the column will be lost.
  - You are about to drop the column `seats` on the `VehicleListing` table. All the data in the column will be lost.
  - You are about to drop the column `transmission` on the `VehicleListing` table. All the data in the column will be lost.
  - You are about to drop the column `vin` on the `VehicleListing` table. All the data in the column will be lost.
  - You are about to drop the column `year` on the `VehicleListing` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[productId,branchId]` on the table `Inventory` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[idempotencyKey]` on the table `InventoryTransaction` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[vehicleTransactionId]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[paymentNumber]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[idempotencyKeyHash]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[settledAttemptId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[provider,deduplicationKey]` on the table `PaymentWebhookEvent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[provider,providerEventId]` on the table `PaymentWebhookEvent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[publicId]` on the table `ProductImage` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[vehicleTransactionId]` on the table `Review` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[customerId,vehicleListingId]` on the table `SavedVehicle` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[publicId]` on the table `VehicleImage` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `customerName` to the `InspectionRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerPhone` to the `InspectionRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `preferredStartAt` to the `InspectionRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vehicleListingId` to the `InspectionRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branchId` to the `Inventory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `idempotencyKey` to the `InventoryTransaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantityAfter` to the `InventoryTransaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantityBefore` to the `InventoryTransaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantityDelta` to the `InventoryTransaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reservedAfter` to the `InventoryTransaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reservedBefore` to the `InventoryTransaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotalKobo` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalKobo` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotalKobo` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalKobo` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotalKobo` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unitPriceKobo` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `amountKobo` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `idempotencyKeyHash` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentNumber` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `purpose` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deduplicationKey` to the `PaymentWebhookEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `payloadSha256` to the `PaymentWebhookEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `provider` to the `PaymentWebhookEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `signatureVerifiedAt` to the `PaymentWebhookEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PaymentWebhookEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `priceKobo` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `discountAmountKobo` to the `PromotionUsage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vehicleListingId` to the `SavedVehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branchId` to the `VehicleListing` table without a default value. This is not possible if the table is not empty.
  - Added the required column `priceKobo` to the `VehicleListing` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vehicleId` to the `VehicleListing` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MfaFactorType" AS ENUM ('TOTP', 'WEBAUTHN');

-- CreateEnum
CREATE TYPE "MfaFactorStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'ISSUED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'VOID');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('DRAFT', 'APPROVED', 'IN_PROGRESS', 'AWAITING_PARTS', 'QUALITY_CHECK', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LineItemType" AS ENUM ('LABOUR', 'PART', 'FEE');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('REQUIRES_PAYMENT', 'PROCESSING', 'REQUIRES_REVIEW', 'SUCCEEDED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('INITIALIZED', 'PENDING', 'PROCESSING', 'SUCCESSFUL', 'FAILED', 'ABANDONED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentVerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'MISMATCH', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('PAYSTACK', 'MANUAL');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'BANK_TRANSFER', 'USSD', 'MOBILE_MONEY', 'QR', 'POS', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('ORDER_PAYMENT', 'SERVICE_INVOICE', 'VEHICLE_RESERVATION', 'VEHICLE_PARTIAL_PAYMENT', 'VEHICLE_BALANCE_PAYMENT', 'VEHICLE_FULL_PAYMENT');

-- CreateEnum
CREATE TYPE "ManualPaymentReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PENDING', 'PROCESSING', 'NEEDS_ATTENTION', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('AWAITING_RESPONSE', 'UNDER_REVIEW', 'WON', 'LOST', 'ACCEPTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DisputeCategory" AS ENUM ('NOT_RECOGNIZED', 'FRAUD', 'NOT_RECEIVED', 'NOT_AS_DESCRIBED', 'DUPLICATE_CHARGE', 'REFUND_NOT_RECEIVED', 'OTHER');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "PaymentAnomalyType" AS ENUM ('UNKNOWN_REFERENCE', 'AMOUNT_MISMATCH', 'CURRENCY_MISMATCH', 'DUPLICATE_SUCCESS', 'LATE_SUCCESS', 'REFUND_MISMATCH', 'WEBHOOK_REPLAY', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentAnomalyStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "PaymentLedgerEntryType" AS ENUM ('CAPTURE', 'REFUND', 'CHARGEBACK', 'REVERSAL');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('RUNNING', 'MATCHED', 'DIFFERENCES_FOUND', 'FAILED');

-- CreateEnum
CREATE TYPE "ReconciliationItemStatus" AS ENUM ('MATCHED', 'MISSING_IN_PROVIDER', 'MISSING_LOCALLY', 'AMOUNT_MISMATCH', 'CURRENCY_MISMATCH', 'STATUS_MISMATCH');

-- CreateEnum
CREATE TYPE "VehicleTransactionStatus" AS ENUM ('ENQUIRY', 'INSPECTION_SCHEDULED', 'INSPECTION_COMPLETED', 'NEGOTIATING', 'PAYMENT_PENDING', 'RESERVED', 'PARTIALLY_PAID', 'PAID', 'HANDOVER_PENDING', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VehicleDocumentType" AS ENUM ('OWNERSHIP', 'REGISTRATION', 'CUSTOMS_CLEARANCE', 'PURCHASE_RECEIPT', 'INSPECTION_REPORT', 'SERVICE_HISTORY', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VehicleHandoverStatus" AS ENUM ('PENDING', 'READY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED', 'DEAD_LETTER');

-- DropForeignKey
ALTER TABLE "Enquiry" DROP CONSTRAINT "Enquiry_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "InspectionRequest" DROP CONSTRAINT "InspectionRequest_customerId_fkey";

-- DropForeignKey
ALTER TABLE "InspectionRequest" DROP CONSTRAINT "InspectionRequest_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_orderId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentWebhookEvent" DROP CONSTRAINT "PaymentWebhookEvent_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "SavedVehicle" DROP CONSTRAINT "SavedVehicle_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "VehicleImage" DROP CONSTRAINT "VehicleImage_vehicleId_fkey";

-- DropIndex
DROP INDEX "Enquiry_vehicleId_idx";

-- DropIndex
DROP INDEX "InspectionRequest_customerId_requestedAt_idx";

-- DropIndex
DROP INDEX "InspectionRequest_status_requestedAt_idx";

-- DropIndex
DROP INDEX "InspectionRequest_vehicleId_idx";

-- DropIndex
DROP INDEX "Inventory_productId_key";

-- DropIndex
DROP INDEX "Inventory_quantity_idx";

-- DropIndex
DROP INDEX "Payment_createdAt_idx";

-- DropIndex
DROP INDEX "Payment_gatewayTransactionId_key";

-- DropIndex
DROP INDEX "Payment_reference_key";

-- DropIndex
DROP INDEX "Payment_status_idx";

-- DropIndex
DROP INDEX "PaymentWebhookEvent_createdAt_idx";

-- DropIndex
DROP INDEX "PaymentWebhookEvent_eventId_key";

-- DropIndex
DROP INDEX "PaymentWebhookEvent_eventType_idx";

-- DropIndex
DROP INDEX "PaymentWebhookEvent_paymentId_idx";

-- DropIndex
DROP INDEX "SavedVehicle_customerId_vehicleId_key";

-- DropIndex
DROP INDEX "SavedVehicle_vehicleId_idx";

-- DropIndex
DROP INDEX "VehicleListing_status_make_model_idx";

-- DropIndex
DROP INDEX "VehicleListing_status_price_idx";

-- DropIndex
DROP INDEX "VehicleListing_status_year_idx";

-- DropIndex
DROP INDEX "VehicleListing_vin_key";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "quotedPrice",
ADD COLUMN     "quotedPriceKobo" BIGINT,
ALTER COLUMN "currency" SET DATA TYPE CHAR(3);

-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "vehicleTransactionId" UUID;

-- AlterTable
ALTER TABLE "CustomerVehicle" DROP COLUMN "mileage",
ADD COLUMN     "mileageKm" INTEGER;

-- AlterTable
ALTER TABLE "Enquiry" DROP COLUMN "vehicleId",
ADD COLUMN     "bookingId" UUID,
ADD COLUMN     "quoteId" UUID,
ADD COLUMN     "vehicleListingId" UUID;

-- AlterTable
ALTER TABLE "InspectionRequest" DROP COLUMN "requestedAt",
DROP COLUMN "scheduledAt",
DROP COLUMN "vehicleId",
ADD COLUMN     "customerEmail" CITEXT,
ADD COLUMN     "customerName" TEXT NOT NULL,
ADD COLUMN     "customerPhone" VARCHAR(32) NOT NULL,
ADD COLUMN     "preferredEndAt" TIMESTAMP(3),
ADD COLUMN     "preferredStartAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "scheduledEndAt" TIMESTAMP(3),
ADD COLUMN     "scheduledStartAt" TIMESTAMP(3),
ADD COLUMN     "vehicleListingId" UUID NOT NULL,
ALTER COLUMN "customerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Inventory" ADD COLUMN     "branchId" UUID NOT NULL,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "InventoryTransaction" DROP COLUMN "quantity",
ADD COLUMN     "idempotencyKey" VARCHAR(120) NOT NULL,
ADD COLUMN     "performedById" UUID,
ADD COLUMN     "quantityAfter" INTEGER NOT NULL,
ADD COLUMN     "quantityBefore" INTEGER NOT NULL,
ADD COLUMN     "quantityDelta" INTEGER NOT NULL,
ADD COLUMN     "reservedAfter" INTEGER NOT NULL,
ADD COLUMN     "reservedBefore" INTEGER NOT NULL,
ADD COLUMN     "reservedDelta" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "subtotal",
DROP COLUMN "tax",
DROP COLUMN "total",
ADD COLUMN     "subtotalKobo" BIGINT NOT NULL,
ADD COLUMN     "taxKobo" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "totalKobo" BIGINT NOT NULL,
ADD COLUMN     "vehicleTransactionId" UUID,
ALTER COLUMN "invoiceNumber" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "currency" SET DATA TYPE CHAR(3);

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "deliveryFee",
DROP COLUMN "discountAmount",
DROP COLUMN "subtotal",
DROP COLUMN "total",
ADD COLUMN     "deliveryFeeKobo" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "discountAmountKobo" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "subtotalKobo" BIGINT NOT NULL,
ADD COLUMN     "totalKobo" BIGINT NOT NULL,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "orderNumber" SET DATA TYPE VARCHAR(40),
ALTER COLUMN "currency" SET DATA TYPE CHAR(3);

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "subtotal",
DROP COLUMN "unitPrice",
ADD COLUMN     "subtotalKobo" BIGINT NOT NULL,
ADD COLUMN     "unitPriceKobo" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "amount",
DROP COLUMN "failureReason",
DROP COLUMN "gateway",
DROP COLUMN "gatewayResponse",
DROP COLUMN "gatewayTransactionId",
DROP COLUMN "paidAt",
DROP COLUMN "reference",
DROP COLUMN "verifiedAt",
ADD COLUMN     "amountKobo" BIGINT NOT NULL,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "customerId" UUID,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "expiredAt" TIMESTAMP(3),
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "idempotencyKeyHash" CHAR(64) NOT NULL,
ADD COLUMN     "invoiceId" UUID,
ADD COLUMN     "paymentNumber" VARCHAR(50) NOT NULL,
ADD COLUMN     "purpose" "PaymentPurpose" NOT NULL,
ADD COLUMN     "settledAttemptId" UUID,
ADD COLUMN     "succeededAt" TIMESTAMP(3),
ADD COLUMN     "vehicleTransactionId" UUID,
ALTER COLUMN "orderId" DROP NOT NULL,
ALTER COLUMN "currency" SET DATA TYPE CHAR(3),
DROP COLUMN "status",
ADD COLUMN     "status" "PaymentIntentStatus" NOT NULL DEFAULT 'REQUIRES_PAYMENT';

-- AlterTable
ALTER TABLE "PaymentWebhookEvent" DROP COLUMN "eventId",
DROP COLUMN "payload",
DROP COLUMN "paymentId",
DROP COLUMN "processingError",
ADD COLUMN     "deduplicationKey" CHAR(64) NOT NULL,
ADD COLUMN     "disputeId" UUID,
ADD COLUMN     "lastErrorCode" VARCHAR(100),
ADD COLUMN     "lastErrorMessage" TEXT,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN     "payloadSha256" CHAR(64) NOT NULL,
ADD COLUMN     "paymentAttemptId" UUID,
ADD COLUMN     "processingAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "provider" "PaymentProvider" NOT NULL,
ADD COLUMN     "providerEventId" VARCHAR(180),
ADD COLUMN     "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "redactedPayload" JSONB,
ADD COLUMN     "refundId" UUID,
ADD COLUMN     "signatureVerifiedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "status" "WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "price",
ADD COLUMN     "compareAtPriceKobo" BIGINT,
ADD COLUMN     "priceKobo" BIGINT NOT NULL,
ALTER COLUMN "currency" SET DATA TYPE CHAR(3);

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicId" TEXT;

-- AlterTable
ALTER TABLE "Promotion" DROP COLUMN "discountValue",
DROP COLUMN "maximumDiscountAmount",
DROP COLUMN "minimumOrderAmount",
ADD COLUMN     "fixedAmountKobo" BIGINT,
ADD COLUMN     "maximumDiscountAmountKobo" BIGINT,
ADD COLUMN     "minimumOrderAmountKobo" BIGINT,
ADD COLUMN     "percentageBasisPoints" INTEGER;

-- AlterTable
ALTER TABLE "PromotionUsage" DROP COLUMN "discountAmount",
DROP COLUMN "discountValueSnapshot",
ADD COLUMN     "discountAmountKobo" BIGINT NOT NULL,
ADD COLUMN     "fixedAmountKoboSnapshot" BIGINT,
ADD COLUMN     "percentageBasisPointsSnapshot" INTEGER;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "vehicleTransactionId" UUID;

-- AlterTable
ALTER TABLE "SavedVehicle" DROP COLUMN "vehicleId",
ADD COLUMN     "vehicleListingId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "Service" DROP COLUMN "price",
ADD COLUMN     "priceKobo" BIGINT,
ALTER COLUMN "currency" SET DATA TYPE CHAR(3);

-- AlterTable
ALTER TABLE "StaffProfile" ADD COLUMN     "branchId" UUID;

-- AlterTable
ALTER TABLE "VehicleImage" ADD COLUMN     "checksumSha256" CHAR(64),
ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicId" TEXT;

-- AlterTable
ALTER TABLE "VehicleListing" DROP COLUMN "bodyType",
DROP COLUMN "color",
DROP COLUMN "condition",
DROP COLUMN "doors",
DROP COLUMN "driveType",
DROP COLUMN "engineSize",
DROP COLUMN "fuelType",
DROP COLUMN "make",
DROP COLUMN "mileage",
DROP COLUMN "model",
DROP COLUMN "price",
DROP COLUMN "registrationNumber",
DROP COLUMN "seats",
DROP COLUMN "transmission",
DROP COLUMN "vin",
DROP COLUMN "year",
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "branchId" UUID NOT NULL,
ADD COLUMN     "priceKobo" BIGINT NOT NULL,
ADD COLUMN     "reservedAt" TIMESTAMP(3),
ADD COLUMN     "vehicleId" UUID NOT NULL,
ALTER COLUMN "currency" SET DATA TYPE CHAR(3);

-- DropEnum
DROP TYPE "PaymentGateway";

-- DropEnum
DROP TYPE "PaymentStatus";

-- CreateTable
CREATE TABLE "MfaFactor" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "MfaFactorType" NOT NULL,
    "status" "MfaFactorStatus" NOT NULL DEFAULT 'PENDING',
    "name" VARCHAR(100),
    "encryptedSecret" BYTEA,
    "encryptionKeyId" VARCHAR(120),
    "credentialId" VARCHAR(500),
    "publicKey" BYTEA,
    "signCount" BIGINT DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MfaFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaRecoveryCode" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeHash" VARCHAR(128) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" UUID NOT NULL,
    "code" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" VARCHAR(32),
    "email" CITEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Nigeria',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Africa/Lagos',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceQuote" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "createdByStaffId" UUID NOT NULL,
    "quoteNumber" VARCHAR(40) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "subtotalKobo" BIGINT NOT NULL,
    "taxKobo" BIGINT NOT NULL DEFAULT 0,
    "totalKobo" BIGINT NOT NULL,
    "notes" TEXT,
    "expiresAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" UUID NOT NULL,
    "serviceQuoteId" UUID NOT NULL,
    "productId" UUID,
    "type" "LineItemType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceKobo" BIGINT NOT NULL,
    "subtotalKobo" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "workOrderNumber" VARCHAR(40) NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "diagnosis" TEXT,
    "internalNotes" TEXT,
    "openedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderItem" (
    "id" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "productId" UUID,
    "type" "LineItemType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceKobo" BIGINT NOT NULL,
    "subtotalKobo" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "internalReference" VARCHAR(120) NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "method" "PaymentMethod",
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'INITIALIZED',
    "verificationStatus" "PaymentVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "amountKobo" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "verifiedAmountKobo" BIGINT,
    "verifiedCurrency" CHAR(3),
    "providerReference" VARCHAR(160),
    "gatewayTransactionId" VARCHAR(160),
    "providerFeeKobo" BIGINT,
    "gatewayStatus" VARCHAR(80),
    "failureCode" VARCHAR(100),
    "failureMessage" TEXT,
    "redactedGatewayData" JSONB,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "abandonedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualPaymentReview" (
    "id" UUID NOT NULL,
    "paymentAttemptId" UUID NOT NULL,
    "submittedByUserId" UUID,
    "reviewedByUserId" UUID,
    "status" "ManualPaymentReviewStatus" NOT NULL DEFAULT 'PENDING',
    "bankReference" VARCHAR(160),
    "payerName" TEXT,
    "transferredAt" TIMESTAMP(3),
    "evidenceObjectKey" TEXT,
    "evidenceSha256" CHAR(64),
    "reviewerNote" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualPaymentReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" UUID NOT NULL,
    "paymentAttemptId" UUID NOT NULL,
    "requestedByUserId" UUID NOT NULL,
    "approvedByUserId" UUID,
    "refundNumber" VARCHAR(50) NOT NULL,
    "idempotencyKeyHash" CHAR(64) NOT NULL,
    "providerRefundId" VARCHAR(160),
    "amountKobo" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "providerStatus" VARCHAR(80),
    "failureCode" VARCHAR(100),
    "failureMessage" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentDispute" (
    "id" UUID NOT NULL,
    "paymentAttemptId" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerDisputeId" VARCHAR(160) NOT NULL,
    "status" "DisputeStatus" NOT NULL,
    "category" "DisputeCategory" NOT NULL,
    "amountKobo" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "reason" TEXT,
    "responseDueAt" TIMESTAMP(3),
    "evidenceObjectKey" TEXT,
    "evidenceSha256" CHAR(64),
    "openedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAnomaly" (
    "id" UUID NOT NULL,
    "paymentId" UUID,
    "paymentAttemptId" UUID,
    "refundId" UUID,
    "disputeId" UUID,
    "resolvedByUserId" UUID,
    "type" "PaymentAnomalyType" NOT NULL,
    "status" "PaymentAnomalyStatus" NOT NULL DEFAULT 'OPEN',
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAnomaly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentLedgerEntry" (
    "id" UUID NOT NULL,
    "paymentAttemptId" UUID,
    "refundId" UUID,
    "disputeId" UUID,
    "sourceKey" VARCHAR(200) NOT NULL,
    "type" "PaymentLedgerEntryType" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amountKobo" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReconciliationRun" (
    "id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'RUNNING',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "differenceCount" INTEGER NOT NULL DEFAULT 0,
    "providerTotalKobo" BIGINT NOT NULL DEFAULT 0,
    "internalTotalKobo" BIGINT NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReconciliationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReconciliationItem" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "paymentAttemptId" UUID,
    "refundId" UUID,
    "disputeId" UUID,
    "status" "ReconciliationItemStatus" NOT NULL,
    "providerReference" VARCHAR(160),
    "providerAmountKobo" BIGINT,
    "internalAmountKobo" BIGINT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReconciliationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "stockNumber" VARCHAR(40) NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "trim" TEXT,
    "year" INTEGER NOT NULL,
    "mileageKm" INTEGER,
    "transmission" "Transmission",
    "fuelType" "FuelType",
    "condition" "VehicleCondition" NOT NULL DEFAULT 'USED',
    "bodyType" "BodyType",
    "engineSize" TEXT,
    "driveType" "DriveType",
    "color" TEXT,
    "doors" INTEGER,
    "seats" INTEGER,
    "vin" VARCHAR(17),
    "chassisNumber" VARCHAR(80),
    "registrationNumber" TEXT,
    "acquisitionCostKobo" BIGINT,
    "acquisitionCurrency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "acquiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehiclePriceHistory" (
    "id" UUID NOT NULL,
    "vehicleListingId" UUID NOT NULL,
    "changedByStaffId" UUID NOT NULL,
    "oldPriceKobo" BIGINT NOT NULL,
    "newPriceKobo" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehiclePriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleDocument" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "reviewedByStaffId" UUID,
    "type" "VehicleDocumentType" NOT NULL,
    "verificationStatus" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "objectKey" TEXT NOT NULL,
    "checksumSha256" CHAR(64) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleConditionReport" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "inspectionId" UUID,
    "odometerKm" INTEGER,
    "conditionScore" INTEGER,
    "summary" TEXT NOT NULL,
    "findings" JSONB,
    "reportObjectKey" TEXT,
    "reportSha256" CHAR(64),
    "inspectedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleConditionReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleTransaction" (
    "id" UUID NOT NULL,
    "vehicleListingId" UUID NOT NULL,
    "customerId" UUID,
    "sourceEnquiryId" UUID,
    "sourceInspectionId" UUID,
    "transactionNumber" VARCHAR(50) NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" VARCHAR(32) NOT NULL,
    "customerEmail" CITEXT,
    "askingPriceKobo" BIGINT NOT NULL,
    "agreedPriceKobo" BIGINT,
    "reservationRequiredKobo" BIGINT,
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "status" "VehicleTransactionStatus" NOT NULL DEFAULT 'ENQUIRY',
    "reservationExpiresAt" TIMESTAMP(3),
    "termsVersion" VARCHAR(40),
    "termsAcceptedAt" TIMESTAMP(3),
    "notes" TEXT,
    "cancellationReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "handoverPendingAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleTransactionStatusHistory" (
    "id" UUID NOT NULL,
    "vehicleTransactionId" UUID NOT NULL,
    "changedByUserId" UUID,
    "fromStatus" "VehicleTransactionStatus",
    "toStatus" "VehicleTransactionStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleTransactionStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleHandover" (
    "id" UUID NOT NULL,
    "vehicleTransactionId" UUID NOT NULL,
    "handledByStaffId" UUID NOT NULL,
    "status" "VehicleHandoverStatus" NOT NULL DEFAULT 'PENDING',
    "recipientName" TEXT,
    "recipientPhone" VARCHAR(32),
    "odometerKm" INTEGER,
    "keysDelivered" INTEGER NOT NULL DEFAULT 0,
    "signedDocumentObjectKey" TEXT,
    "signedDocumentSha256" CHAR(64),
    "readyAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleHandover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "scope" VARCHAR(100) NOT NULL,
    "keyHash" CHAR(64) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "lockedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "aggregateType" VARCHAR(100) NOT NULL,
    "aggregateId" VARCHAR(120) NOT NULL,
    "eventType" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MfaFactor_credentialId_key" ON "MfaFactor"("credentialId");

-- CreateIndex
CREATE INDEX "MfaFactor_userId_status_idx" ON "MfaFactor"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MfaRecoveryCode_codeHash_key" ON "MfaRecoveryCode"("codeHash");

-- CreateIndex
CREATE INDEX "MfaRecoveryCode_userId_usedAt_idx" ON "MfaRecoveryCode"("userId", "usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE INDEX "Branch_isActive_idx" ON "Branch"("isActive");

-- CreateIndex
CREATE INDEX "Branch_state_city_idx" ON "Branch"("state", "city");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceQuote_quoteNumber_key" ON "ServiceQuote"("quoteNumber");

-- CreateIndex
CREATE INDEX "ServiceQuote_bookingId_status_idx" ON "ServiceQuote"("bookingId", "status");

-- CreateIndex
CREATE INDEX "ServiceQuote_status_expiresAt_idx" ON "ServiceQuote"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceQuote_bookingId_version_key" ON "ServiceQuote"("bookingId", "version");

-- CreateIndex
CREATE INDEX "QuoteItem_serviceQuoteId_idx" ON "QuoteItem"("serviceQuoteId");

-- CreateIndex
CREATE INDEX "QuoteItem_productId_idx" ON "QuoteItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_bookingId_key" ON "WorkOrder"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_workOrderNumber_key" ON "WorkOrder"("workOrderNumber");

-- CreateIndex
CREATE INDEX "WorkOrder_status_createdAt_idx" ON "WorkOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WorkOrderItem_workOrderId_idx" ON "WorkOrderItem"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkOrderItem_productId_idx" ON "WorkOrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_internalReference_key" ON "PaymentAttempt"("internalReference");

-- CreateIndex
CREATE INDEX "PaymentAttempt_paymentId_status_idx" ON "PaymentAttempt"("paymentId", "status");

-- CreateIndex
CREATE INDEX "PaymentAttempt_provider_gatewayTransactionId_idx" ON "PaymentAttempt"("provider", "gatewayTransactionId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_status_createdAt_idx" ON "PaymentAttempt"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_paymentId_attemptNumber_key" ON "PaymentAttempt"("paymentId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_provider_providerReference_key" ON "PaymentAttempt"("provider", "providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "ManualPaymentReview_paymentAttemptId_key" ON "ManualPaymentReview"("paymentAttemptId");

-- CreateIndex
CREATE INDEX "ManualPaymentReview_status_submittedAt_idx" ON "ManualPaymentReview"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "ManualPaymentReview_reviewedByUserId_idx" ON "ManualPaymentReview"("reviewedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_refundNumber_key" ON "Refund"("refundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_idempotencyKeyHash_key" ON "Refund"("idempotencyKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_providerRefundId_key" ON "Refund"("providerRefundId");

-- CreateIndex
CREATE INDEX "Refund_paymentAttemptId_status_idx" ON "Refund"("paymentAttemptId", "status");

-- CreateIndex
CREATE INDEX "Refund_status_createdAt_idx" ON "Refund"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Refund_approvedByUserId_idx" ON "Refund"("approvedByUserId");

-- CreateIndex
CREATE INDEX "PaymentDispute_paymentAttemptId_idx" ON "PaymentDispute"("paymentAttemptId");

-- CreateIndex
CREATE INDEX "PaymentDispute_status_responseDueAt_idx" ON "PaymentDispute"("status", "responseDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentDispute_provider_providerDisputeId_key" ON "PaymentDispute"("provider", "providerDisputeId");

-- CreateIndex
CREATE INDEX "PaymentAnomaly_status_detectedAt_idx" ON "PaymentAnomaly"("status", "detectedAt");

-- CreateIndex
CREATE INDEX "PaymentAnomaly_paymentId_idx" ON "PaymentAnomaly"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAnomaly_paymentAttemptId_idx" ON "PaymentAnomaly"("paymentAttemptId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentLedgerEntry_sourceKey_key" ON "PaymentLedgerEntry"("sourceKey");

-- CreateIndex
CREATE INDEX "PaymentLedgerEntry_paymentAttemptId_occurredAt_idx" ON "PaymentLedgerEntry"("paymentAttemptId", "occurredAt");

-- CreateIndex
CREATE INDEX "PaymentLedgerEntry_refundId_idx" ON "PaymentLedgerEntry"("refundId");

-- CreateIndex
CREATE INDEX "PaymentLedgerEntry_disputeId_idx" ON "PaymentLedgerEntry"("disputeId");

-- CreateIndex
CREATE INDEX "PaymentLedgerEntry_occurredAt_idx" ON "PaymentLedgerEntry"("occurredAt");

-- CreateIndex
CREATE INDEX "PaymentReconciliationRun_status_startedAt_idx" ON "PaymentReconciliationRun"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReconciliationRun_provider_periodStart_periodEnd_key" ON "PaymentReconciliationRun"("provider", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "PaymentReconciliationItem_runId_status_idx" ON "PaymentReconciliationItem"("runId", "status");

-- CreateIndex
CREATE INDEX "PaymentReconciliationItem_paymentAttemptId_idx" ON "PaymentReconciliationItem"("paymentAttemptId");

-- CreateIndex
CREATE INDEX "PaymentReconciliationItem_refundId_idx" ON "PaymentReconciliationItem"("refundId");

-- CreateIndex
CREATE INDEX "PaymentReconciliationItem_disputeId_idx" ON "PaymentReconciliationItem"("disputeId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_stockNumber_key" ON "Vehicle"("stockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vin_key" ON "Vehicle"("vin");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_chassisNumber_key" ON "Vehicle"("chassisNumber");

-- CreateIndex
CREATE INDEX "Vehicle_branchId_idx" ON "Vehicle"("branchId");

-- CreateIndex
CREATE INDEX "Vehicle_make_model_idx" ON "Vehicle"("make", "model");

-- CreateIndex
CREATE INDEX "Vehicle_year_idx" ON "Vehicle"("year");

-- CreateIndex
CREATE INDEX "VehiclePriceHistory_vehicleListingId_createdAt_idx" ON "VehiclePriceHistory"("vehicleListingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleDocument_objectKey_key" ON "VehicleDocument"("objectKey");

-- CreateIndex
CREATE INDEX "VehicleDocument_vehicleId_type_idx" ON "VehicleDocument"("vehicleId", "type");

-- CreateIndex
CREATE INDEX "VehicleDocument_verificationStatus_idx" ON "VehicleDocument"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleConditionReport_inspectionId_key" ON "VehicleConditionReport"("inspectionId");

-- CreateIndex
CREATE INDEX "VehicleConditionReport_vehicleId_inspectedAt_idx" ON "VehicleConditionReport"("vehicleId", "inspectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleTransaction_sourceEnquiryId_key" ON "VehicleTransaction"("sourceEnquiryId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleTransaction_sourceInspectionId_key" ON "VehicleTransaction"("sourceInspectionId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleTransaction_transactionNumber_key" ON "VehicleTransaction"("transactionNumber");

-- CreateIndex
CREATE INDEX "VehicleTransaction_vehicleListingId_status_idx" ON "VehicleTransaction"("vehicleListingId", "status");

-- CreateIndex
CREATE INDEX "VehicleTransaction_customerId_createdAt_idx" ON "VehicleTransaction"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "VehicleTransaction_status_createdAt_idx" ON "VehicleTransaction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "VehicleTransaction_reservationExpiresAt_idx" ON "VehicleTransaction"("reservationExpiresAt");

-- CreateIndex
CREATE INDEX "VehicleTransactionStatusHistory_vehicleTransactionId_create_idx" ON "VehicleTransactionStatusHistory"("vehicleTransactionId", "createdAt");

-- CreateIndex
CREATE INDEX "VehicleTransactionStatusHistory_changedByUserId_idx" ON "VehicleTransactionStatusHistory"("changedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleHandover_vehicleTransactionId_key" ON "VehicleHandover"("vehicleTransactionId");

-- CreateIndex
CREATE INDEX "VehicleHandover_status_createdAt_idx" ON "VehicleHandover"("status", "createdAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_status_expiresAt_idx" ON "IdempotencyRecord"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_userId_createdAt_idx" ON "IdempotencyRecord"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_scope_keyHash_key" ON "IdempotencyRecord"("scope", "keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_eventId_key" ON "OutboxEvent"("eventId");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_availableAt_idx" ON "OutboxEvent"("status", "availableAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_idx" ON "OutboxEvent"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "Complaint_vehicleTransactionId_idx" ON "Complaint"("vehicleTransactionId");

-- CreateIndex
CREATE INDEX "Enquiry_vehicleListingId_idx" ON "Enquiry"("vehicleListingId");

-- CreateIndex
CREATE INDEX "Enquiry_bookingId_idx" ON "Enquiry"("bookingId");

-- CreateIndex
CREATE INDEX "Enquiry_quoteId_idx" ON "Enquiry"("quoteId");

-- CreateIndex
CREATE INDEX "InspectionRequest_customerId_preferredStartAt_idx" ON "InspectionRequest"("customerId", "preferredStartAt");

-- CreateIndex
CREATE INDEX "InspectionRequest_vehicleListingId_status_idx" ON "InspectionRequest"("vehicleListingId", "status");

-- CreateIndex
CREATE INDEX "InspectionRequest_status_preferredStartAt_idx" ON "InspectionRequest"("status", "preferredStartAt");

-- CreateIndex
CREATE INDEX "Inventory_branchId_quantity_idx" ON "Inventory"("branchId", "quantity");

-- CreateIndex
CREATE INDEX "Inventory_productId_idx" ON "Inventory"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_productId_branchId_key" ON "Inventory"("productId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTransaction_idempotencyKey_key" ON "InventoryTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "InventoryTransaction_performedById_idx" ON "InventoryTransaction"("performedById");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_vehicleTransactionId_key" ON "Invoice"("vehicleTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentNumber_key" ON "Payment"("paymentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKeyHash_key" ON "Payment"("idempotencyKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_settledAttemptId_key" ON "Payment"("settledAttemptId");

-- CreateIndex
CREATE INDEX "Payment_customerId_createdAt_idx" ON "Payment"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_orderId_status_idx" ON "Payment"("orderId", "status");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_status_idx" ON "Payment"("invoiceId", "status");

-- CreateIndex
CREATE INDEX "Payment_vehicleTransactionId_status_idx" ON "Payment"("vehicleTransactionId", "status");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_status_nextAttemptAt_receivedAt_idx" ON "PaymentWebhookEvent"("status", "nextAttemptAt", "receivedAt");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_paymentAttemptId_idx" ON "PaymentWebhookEvent"("paymentAttemptId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_refundId_idx" ON "PaymentWebhookEvent"("refundId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_disputeId_idx" ON "PaymentWebhookEvent"("disputeId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_eventType_receivedAt_idx" ON "PaymentWebhookEvent"("eventType", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_deduplicationKey_key" ON "PaymentWebhookEvent"("provider", "deduplicationKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_providerEventId_key" ON "PaymentWebhookEvent"("provider", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_publicId_key" ON "ProductImage"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_vehicleTransactionId_key" ON "Review"("vehicleTransactionId");

-- CreateIndex
CREATE INDEX "SavedVehicle_vehicleListingId_idx" ON "SavedVehicle"("vehicleListingId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedVehicle_customerId_vehicleListingId_key" ON "SavedVehicle"("customerId", "vehicleListingId");

-- CreateIndex
CREATE INDEX "StaffProfile_branchId_idx" ON "StaffProfile"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleImage_publicId_key" ON "VehicleImage"("publicId");

-- CreateIndex
CREATE INDEX "VehicleListing_branchId_status_idx" ON "VehicleListing"("branchId", "status");

-- CreateIndex
CREATE INDEX "VehicleListing_vehicleId_idx" ON "VehicleListing"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleListing_status_priceKobo_idx" ON "VehicleListing"("status", "priceKobo");

-- CreateIndex
CREATE INDEX "VehicleListing_createdAt_idx" ON "VehicleListing"("createdAt");

-- AddForeignKey
ALTER TABLE "MfaFactor" ADD CONSTRAINT "MfaFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaRecoveryCode" ADD CONSTRAINT "MfaRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceQuote" ADD CONSTRAINT "ServiceQuote_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceQuote" ADD CONSTRAINT "ServiceQuote_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "StaffProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_serviceQuoteId_fkey" FOREIGN KEY ("serviceQuoteId") REFERENCES "ServiceQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderItem" ADD CONSTRAINT "WorkOrderItem_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderItem" ADD CONSTRAINT "WorkOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_vehicleTransactionId_fkey" FOREIGN KEY ("vehicleTransactionId") REFERENCES "VehicleTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_settledAttemptId_fkey" FOREIGN KEY ("settledAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualPaymentReview" ADD CONSTRAINT "ManualPaymentReview_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualPaymentReview" ADD CONSTRAINT "ManualPaymentReview_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualPaymentReview" ADD CONSTRAINT "ManualPaymentReview_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentDispute" ADD CONSTRAINT "PaymentDispute_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "PaymentDispute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAnomaly" ADD CONSTRAINT "PaymentAnomaly_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAnomaly" ADD CONSTRAINT "PaymentAnomaly_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAnomaly" ADD CONSTRAINT "PaymentAnomaly_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAnomaly" ADD CONSTRAINT "PaymentAnomaly_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "PaymentDispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAnomaly" ADD CONSTRAINT "PaymentAnomaly_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLedgerEntry" ADD CONSTRAINT "PaymentLedgerEntry_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLedgerEntry" ADD CONSTRAINT "PaymentLedgerEntry_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLedgerEntry" ADD CONSTRAINT "PaymentLedgerEntry_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "PaymentDispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReconciliationItem" ADD CONSTRAINT "PaymentReconciliationItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PaymentReconciliationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReconciliationItem" ADD CONSTRAINT "PaymentReconciliationItem_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReconciliationItem" ADD CONSTRAINT "PaymentReconciliationItem_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReconciliationItem" ADD CONSTRAINT "PaymentReconciliationItem_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "PaymentDispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleListing" ADD CONSTRAINT "VehicleListing_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleListing" ADD CONSTRAINT "VehicleListing_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleImage" ADD CONSTRAINT "VehicleImage_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePriceHistory" ADD CONSTRAINT "VehiclePriceHistory_vehicleListingId_fkey" FOREIGN KEY ("vehicleListingId") REFERENCES "VehicleListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePriceHistory" ADD CONSTRAINT "VehiclePriceHistory_changedByStaffId_fkey" FOREIGN KEY ("changedByStaffId") REFERENCES "StaffProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_reviewedByStaffId_fkey" FOREIGN KEY ("reviewedByStaffId") REFERENCES "StaffProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleConditionReport" ADD CONSTRAINT "VehicleConditionReport_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleConditionReport" ADD CONSTRAINT "VehicleConditionReport_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "InspectionRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRequest" ADD CONSTRAINT "InspectionRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRequest" ADD CONSTRAINT "InspectionRequest_vehicleListingId_fkey" FOREIGN KEY ("vehicleListingId") REFERENCES "VehicleListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTransaction" ADD CONSTRAINT "VehicleTransaction_vehicleListingId_fkey" FOREIGN KEY ("vehicleListingId") REFERENCES "VehicleListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTransaction" ADD CONSTRAINT "VehicleTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTransaction" ADD CONSTRAINT "VehicleTransaction_sourceEnquiryId_fkey" FOREIGN KEY ("sourceEnquiryId") REFERENCES "Enquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTransaction" ADD CONSTRAINT "VehicleTransaction_sourceInspectionId_fkey" FOREIGN KEY ("sourceInspectionId") REFERENCES "InspectionRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTransactionStatusHistory" ADD CONSTRAINT "VehicleTransactionStatusHistory_vehicleTransactionId_fkey" FOREIGN KEY ("vehicleTransactionId") REFERENCES "VehicleTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTransactionStatusHistory" ADD CONSTRAINT "VehicleTransactionStatusHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleHandover" ADD CONSTRAINT "VehicleHandover_vehicleTransactionId_fkey" FOREIGN KEY ("vehicleTransactionId") REFERENCES "VehicleTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleHandover" ADD CONSTRAINT "VehicleHandover_handledByStaffId_fkey" FOREIGN KEY ("handledByStaffId") REFERENCES "StaffProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedVehicle" ADD CONSTRAINT "SavedVehicle_vehicleListingId_fkey" FOREIGN KEY ("vehicleListingId") REFERENCES "VehicleListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_vehicleTransactionId_fkey" FOREIGN KEY ("vehicleTransactionId") REFERENCES "VehicleTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "ServiceQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_vehicleListingId_fkey" FOREIGN KEY ("vehicleListingId") REFERENCES "VehicleListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_vehicleTransactionId_fkey" FOREIGN KEY ("vehicleTransactionId") REFERENCES "VehicleTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_vehicleTransactionId_fkey" FOREIGN KEY ("vehicleTransactionId") REFERENCES "VehicleTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Allied AutoTech Phase 2.1 custom PostgreSQL hardening
-- Target: PostgreSQL, after Prisma has generated the tables/columns from
-- schema.enhanced.prisma and before this migration is applied.
--
-- IMPORTANT:
-- 1. This belongs inside a NEW Prisma migration. Do not edit a migration that
--    has already been applied.
-- 2. Review the expand/backfill/contract instructions in IMPLEMENTATION.md.
-- 3. Prisma does not model these CHECK constraints, partial indexes, or
--    triggers. Preserve this SQL in migration history.
-- 4. Payment secrets, PAN, CVV, full card data, raw webhook signatures, and
--    unredacted gateway payloads must never be stored in these tables.

-- The old rule hides legitimate duplicate captures and prevents vehicle
-- instalments. Settlement is now controlled by Payment.settledAttemptId.
DROP INDEX IF EXISTS "Payment_one_successful_per_order";

-- ---------------------------------------------------------------------------
-- Identity and security
-- ---------------------------------------------------------------------------

ALTER TABLE "User"
  ADD CONSTRAINT "aat_user_failed_login_attempts_nonnegative"
  CHECK ("failedLoginAttempts" >= 0),
  ADD CONSTRAINT "aat_user_lock_time_valid"
  CHECK ("lockedUntil" IS NULL OR "lockedUntil" > "createdAt");

ALTER TABLE "Session"
  ADD CONSTRAINT "aat_session_expiry_valid"
  CHECK ("expiresAt" > "createdAt"),
  ADD CONSTRAINT "aat_session_last_used_valid"
  CHECK ("lastUsedAt" IS NULL OR "lastUsedAt" >= "createdAt"),
  ADD CONSTRAINT "aat_session_revoked_valid"
  CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt");

ALTER TABLE "PasswordResetToken"
  ADD CONSTRAINT "aat_password_reset_expiry_valid"
  CHECK ("expiresAt" > "createdAt"),
  ADD CONSTRAINT "aat_password_reset_terminal_time_valid"
  CHECK (
    ("usedAt" IS NULL OR "usedAt" >= "createdAt")
    AND ("revokedAt" IS NULL OR "revokedAt" >= "createdAt")
    AND NOT ("usedAt" IS NOT NULL AND "revokedAt" IS NOT NULL)
  );

ALTER TABLE "EmailVerificationToken"
  ADD CONSTRAINT "aat_email_verification_expiry_valid"
  CHECK ("expiresAt" > "createdAt"),
  ADD CONSTRAINT "aat_email_verification_terminal_time_valid"
  CHECK (
    ("usedAt" IS NULL OR "usedAt" >= "createdAt")
    AND ("revokedAt" IS NULL OR "revokedAt" >= "createdAt")
    AND NOT ("usedAt" IS NOT NULL AND "revokedAt" IS NOT NULL)
  );

ALTER TABLE "MfaFactor"
  ADD CONSTRAINT "aat_mfa_factor_material_matches_type"
  CHECK (
    (
      "type" = 'TOTP'
      AND "encryptedSecret" IS NOT NULL
      AND "encryptionKeyId" IS NOT NULL
      AND "credentialId" IS NULL
      AND "publicKey" IS NULL
    )
    OR
    (
      "type" = 'WEBAUTHN'
      AND "encryptedSecret" IS NULL
      AND "encryptionKeyId" IS NULL
      AND "credentialId" IS NOT NULL
      AND "publicKey" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "aat_mfa_factor_sign_count_nonnegative"
  CHECK ("signCount" IS NULL OR "signCount" >= 0),
  ADD CONSTRAINT "aat_mfa_factor_status_timestamps"
  CHECK (
    ("status" <> 'ACTIVE' OR "verifiedAt" IS NOT NULL)
    AND ("status" <> 'REVOKED' OR "revokedAt" IS NOT NULL)
  );

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "aat_audit_old_values_object"
  CHECK ("oldValues" IS NULL OR jsonb_typeof("oldValues") = 'object'),
  ADD CONSTRAINT "aat_audit_new_values_object"
  CHECK ("newValues" IS NULL OR jsonb_typeof("newValues") = 'object');

-- ---------------------------------------------------------------------------
-- Shared data rules and minor-unit money
-- ---------------------------------------------------------------------------

ALTER TABLE "Branch"
  ADD CONSTRAINT "aat_branch_code_not_blank"
  CHECK (btrim("code"::text) <> ''),
  ADD CONSTRAINT "aat_branch_name_not_blank"
  CHECK (btrim("name") <> ''),
  ADD CONSTRAINT "aat_branch_timezone_not_blank"
  CHECK (btrim("timezone") <> '');

ALTER TABLE "CustomerVehicle"
  ADD CONSTRAINT "aat_customer_vehicle_year_valid"
  CHECK ("year" BETWEEN 1886 AND 2100),
  ADD CONSTRAINT "aat_customer_vehicle_mileage_nonnegative"
  CHECK ("mileageKm" IS NULL OR "mileageKm" >= 0);

ALTER TABLE "Service"
  ADD CONSTRAINT "aat_service_currency_ngn"
  CHECK ("currency" = 'NGN'),
  ADD CONSTRAINT "aat_service_price_valid"
  CHECK (
    ("pricingType" = 'FIXED' AND "priceKobo" IS NOT NULL AND "priceKobo" >= 0)
    OR
    ("pricingType" = 'QUOTE_REQUIRED' AND ("priceKobo" IS NULL OR "priceKobo" >= 0))
  ),
  ADD CONSTRAINT "aat_service_duration_positive"
  CHECK ("durationMinutes" IS NULL OR "durationMinutes" > 0);

ALTER TABLE "Booking"
  ADD CONSTRAINT "aat_booking_currency_ngn"
  CHECK ("currency" = 'NGN'),
  ADD CONSTRAINT "aat_booking_quote_nonnegative"
  CHECK ("quotedPriceKobo" IS NULL OR "quotedPriceKobo" >= 0),
  ADD CONSTRAINT "aat_booking_status_timestamps"
  CHECK (
    ("status" <> 'CONFIRMED' OR "confirmedAt" IS NOT NULL)
    AND ("status" <> 'IN_PROGRESS' OR "startedAt" IS NOT NULL)
    AND ("status" <> 'COMPLETED' OR "completedAt" IS NOT NULL)
    AND ("status" <> 'CANCELLED' OR ("cancelledAt" IS NOT NULL AND "cancellationReason" IS NOT NULL))
  );

ALTER TABLE "ServiceQuote"
  ADD CONSTRAINT "aat_service_quote_version_positive"
  CHECK ("version" > 0),
  ADD CONSTRAINT "aat_service_quote_currency_ngn"
  CHECK ("currency" = 'NGN'),
  ADD CONSTRAINT "aat_service_quote_amounts_valid"
  CHECK (
    "subtotalKobo" >= 0
    AND "taxKobo" >= 0
    AND "totalKobo" = "subtotalKobo" + "taxKobo"
  ),
  ADD CONSTRAINT "aat_service_quote_expiry_valid"
  CHECK ("expiresAt" IS NULL OR "expiresAt" > "createdAt"),
  ADD CONSTRAINT "aat_service_quote_status_timestamps"
  CHECK (
    ("status" <> 'ISSUED' OR "issuedAt" IS NOT NULL)
    AND ("status" <> 'ACCEPTED' OR "acceptedAt" IS NOT NULL)
    AND ("status" <> 'REJECTED' OR "rejectedAt" IS NOT NULL)
    AND ("status" <> 'VOID' OR "voidedAt" IS NOT NULL)
  );

ALTER TABLE "QuoteItem"
  ADD CONSTRAINT "aat_quote_item_quantity_positive"
  CHECK ("quantity" > 0),
  ADD CONSTRAINT "aat_quote_item_amounts_valid"
  CHECK (
    "unitPriceKobo" >= 0
    AND "subtotalKobo" = "unitPriceKobo" * "quantity"::bigint
  ),
  ADD CONSTRAINT "aat_quote_item_product_matches_type"
  CHECK (
    ("type" = 'PART' AND "productId" IS NOT NULL)
    OR ("type" IN ('LABOUR', 'FEE') AND "productId" IS NULL)
  );

ALTER TABLE "WorkOrderItem"
  ADD CONSTRAINT "aat_work_order_item_quantity_positive"
  CHECK ("quantity" > 0),
  ADD CONSTRAINT "aat_work_order_item_amounts_valid"
  CHECK (
    "unitPriceKobo" >= 0
    AND "subtotalKobo" = "unitPriceKobo" * "quantity"::bigint
  ),
  ADD CONSTRAINT "aat_work_order_item_product_matches_type"
  CHECK (
    ("type" = 'PART' AND "productId" IS NOT NULL)
    OR ("type" IN ('LABOUR', 'FEE') AND "productId" IS NULL)
  );

ALTER TABLE "Product"
  ADD CONSTRAINT "aat_product_price_nonnegative"
  CHECK ("priceKobo" >= 0),
  ADD CONSTRAINT "aat_product_compare_price_valid"
  CHECK ("compareAtPriceKobo" IS NULL OR "compareAtPriceKobo" >= "priceKobo"),
  ADD CONSTRAINT "aat_product_currency_ngn"
  CHECK ("currency" = 'NGN'),
  ADD CONSTRAINT "aat_product_sku_not_blank"
  CHECK (btrim("sku") <> '');

ALTER TABLE "ProductCompatibility"
  ADD CONSTRAINT "aat_product_compatibility_years_valid"
  CHECK (
    ("yearFrom" IS NULL OR "yearFrom" BETWEEN 1886 AND 2100)
    AND ("yearTo" IS NULL OR "yearTo" BETWEEN 1886 AND 2100)
    AND ("yearFrom" IS NULL OR "yearTo" IS NULL OR "yearFrom" <= "yearTo")
  );

ALTER TABLE "ProductImage"
  ADD CONSTRAINT "aat_product_image_sort_nonnegative"
  CHECK ("sortOrder" >= 0);

CREATE UNIQUE INDEX "ProductImage_one_primary_per_product"
  ON "ProductImage" ("productId")
  WHERE "isPrimary" = true;

ALTER TABLE "Inventory"
  ADD CONSTRAINT "aat_inventory_balances_valid"
  CHECK (
    "quantity" >= 0
    AND "reserved" >= 0
    AND "reserved" <= "quantity"
    AND "reorderLevel" >= 0
    AND "version" >= 0
  );

ALTER TABLE "InventoryTransaction"
  ADD CONSTRAINT "aat_inventory_transaction_balances_valid"
  CHECK (
    "quantityBefore" >= 0
    AND "quantityAfter" >= 0
    AND "reservedBefore" >= 0
    AND "reservedAfter" >= 0
    AND "reservedBefore" <= "quantityBefore"
    AND "reservedAfter" <= "quantityAfter"
    AND "quantityAfter" = "quantityBefore" + "quantityDelta"
    AND "reservedAfter" = "reservedBefore" + "reservedDelta"
  ),
  ADD CONSTRAINT "aat_inventory_transaction_delta_matches_type"
  CHECK (
    ("type" IN ('STOCK_IN', 'RETURN', 'RESTOCK') AND "quantityDelta" > 0 AND "reservedDelta" = 0)
    OR ("type" = 'DAMAGE' AND "quantityDelta" < 0 AND "reservedDelta" = 0)
    OR ("type" = 'SALE' AND "quantityDelta" < 0 AND "reservedDelta" <= 0)
    OR ("type" = 'RESERVATION' AND "quantityDelta" = 0 AND "reservedDelta" > 0)
    OR ("type" = 'RESERVATION_RELEASE' AND "quantityDelta" = 0 AND "reservedDelta" < 0)
    OR ("type" = 'ADJUSTMENT' AND ("quantityDelta" <> 0 OR "reservedDelta" <> 0))
  );

ALTER TABLE "CartItem"
  ADD CONSTRAINT "aat_cart_item_quantity_positive"
  CHECK ("quantity" > 0);

ALTER TABLE "Order"
  ADD CONSTRAINT "aat_order_currency_ngn"
  CHECK ("currency" = 'NGN'),
  ADD CONSTRAINT "aat_order_amounts_valid"
  CHECK (
    "subtotalKobo" >= 0
    AND "discountAmountKobo" >= 0
    AND "deliveryFeeKobo" >= 0
    AND "discountAmountKobo" <= "subtotalKobo"
    AND "totalKobo" = "subtotalKobo" - "discountAmountKobo" + "deliveryFeeKobo"
  ),
  ADD CONSTRAINT "aat_order_delivery_address_required"
  CHECK (
    "fulfillmentMethod" <> 'DELIVERY'
    OR (
      "deliveryName" IS NOT NULL
      AND "deliveryPhone" IS NOT NULL
      AND "deliveryAddress" IS NOT NULL
      AND "deliveryCity" IS NOT NULL
      AND "deliveryState" IS NOT NULL
      AND "deliveryCountry" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "aat_order_version_nonnegative"
  CHECK ("version" >= 0),
  ADD CONSTRAINT "aat_order_status_timestamps"
  CHECK (
    ("status" <> 'PROCESSING' OR "processingAt" IS NOT NULL)
    AND ("status" <> 'READY' OR "readyAt" IS NOT NULL)
    AND ("status" <> 'COMPLETED' OR "completedAt" IS NOT NULL)
    AND ("status" <> 'CANCELLED' OR ("cancelledAt" IS NOT NULL AND "cancellationReason" IS NOT NULL))
  );

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "aat_order_item_quantity_positive"
  CHECK ("quantity" > 0),
  ADD CONSTRAINT "aat_order_item_amounts_valid"
  CHECK (
    "unitPriceKobo" >= 0
    AND "subtotalKobo" = "unitPriceKobo" * "quantity"::bigint
  );

-- ---------------------------------------------------------------------------
-- Payment intent, attempts, verification, settlement, refunds and disputes
-- ---------------------------------------------------------------------------

ALTER TABLE "Payment"
  ADD CONSTRAINT "aat_payment_exactly_one_target"
  CHECK (num_nonnulls("orderId", "invoiceId", "vehicleTransactionId") = 1),
  ADD CONSTRAINT "aat_payment_purpose_matches_target"
  CHECK (
    ("purpose" = 'ORDER_PAYMENT' AND "orderId" IS NOT NULL AND "invoiceId" IS NULL AND "vehicleTransactionId" IS NULL)
    OR ("purpose" = 'SERVICE_INVOICE' AND "orderId" IS NULL AND "invoiceId" IS NOT NULL AND "vehicleTransactionId" IS NULL)
    OR (
      "purpose" IN (
        'VEHICLE_RESERVATION',
        'VEHICLE_PARTIAL_PAYMENT',
        'VEHICLE_BALANCE_PAYMENT',
        'VEHICLE_FULL_PAYMENT'
      )
      AND "orderId" IS NULL
      AND "invoiceId" IS NULL
      AND "vehicleTransactionId" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "aat_payment_amount_positive"
  CHECK ("amountKobo" > 0),
  ADD CONSTRAINT "aat_payment_currency_ngn"
  CHECK ("currency" = 'NGN'),
  ADD CONSTRAINT "aat_payment_idempotency_hash_valid"
  CHECK ("idempotencyKeyHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "aat_payment_expiry_valid"
  CHECK ("expiresAt" IS NULL OR "expiresAt" > "createdAt"),
  ADD CONSTRAINT "aat_payment_settlement_state_valid"
  CHECK (
    (
      "status" = 'SUCCEEDED'
      AND "settledAttemptId" IS NOT NULL
      AND "succeededAt" IS NOT NULL
      AND "cancelledAt" IS NULL
      AND "expiredAt" IS NULL
    )
    OR
    (
      "status" <> 'SUCCEEDED'
      AND "settledAttemptId" IS NULL
      AND "succeededAt" IS NULL
    )
  ),
  ADD CONSTRAINT "aat_payment_terminal_state_timestamps"
  CHECK (
    ("status" <> 'CANCELLED' OR ("cancelledAt" IS NOT NULL AND "expiredAt" IS NULL))
    AND ("status" <> 'EXPIRED' OR ("expiredAt" IS NOT NULL AND "cancelledAt" IS NULL))
    AND ("status" IN ('CANCELLED', 'EXPIRED') OR ("cancelledAt" IS NULL AND "expiredAt" IS NULL))
  );

-- Product orders are single-settlement obligations. Vehicle transactions are
-- intentionally excluded because they can have deposit/partial/balance intents.
CREATE UNIQUE INDEX "Payment_one_succeeded_intent_per_order"
  ON "Payment" ("orderId")
  WHERE "orderId" IS NOT NULL AND "status" = 'SUCCEEDED';

ALTER TABLE "PaymentAttempt"
  ADD CONSTRAINT "aat_payment_attempt_number_positive"
  CHECK ("attemptNumber" > 0),
  ADD CONSTRAINT "aat_payment_attempt_amount_positive"
  CHECK ("amountKobo" > 0),
  ADD CONSTRAINT "aat_payment_attempt_currency_ngn"
  CHECK ("currency" = 'NGN' AND ("verifiedCurrency" IS NULL OR "verifiedCurrency" = 'NGN')),
  ADD CONSTRAINT "aat_payment_attempt_verified_amount_nonnegative"
  CHECK ("verifiedAmountKobo" IS NULL OR "verifiedAmountKobo" > 0),
  ADD CONSTRAINT "aat_payment_attempt_fee_nonnegative"
  CHECK ("providerFeeKobo" IS NULL OR "providerFeeKobo" >= 0),
  ADD CONSTRAINT "aat_payment_attempt_verification_fields_valid"
  CHECK (
    (
      "verificationStatus" = 'UNVERIFIED'
      AND "verifiedAmountKobo" IS NULL
      AND "verifiedCurrency" IS NULL
      AND "verifiedAt" IS NULL
    )
    OR
    (
      "verificationStatus" <> 'UNVERIFIED'
      AND "verifiedAmountKobo" IS NOT NULL
      AND "verifiedCurrency" IS NOT NULL
      AND "verifiedAt" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "aat_payment_attempt_verification_outcome_valid"
  CHECK (
    "verificationStatus" NOT IN ('VERIFIED', 'MISMATCH')
    OR (
      "verificationStatus" = 'VERIFIED'
      AND "verifiedAmountKobo" = "amountKobo"
      AND "verifiedCurrency" = "currency"
    )
    OR (
      "verificationStatus" = 'MISMATCH'
      AND (
        "verifiedAmountKobo" IS DISTINCT FROM "amountKobo"
        OR "verifiedCurrency" IS DISTINCT FROM "currency"
      )
    )
  ),
  ADD CONSTRAINT "aat_payment_attempt_success_fields_valid"
  CHECK ("status" <> 'SUCCESSFUL' OR "paidAt" IS NOT NULL),
  ADD CONSTRAINT "aat_payment_attempt_failure_fields_valid"
  CHECK ("status" <> 'FAILED' OR "failedAt" IS NOT NULL),
  ADD CONSTRAINT "aat_payment_attempt_abandoned_fields_valid"
  CHECK ("status" <> 'ABANDONED' OR "abandonedAt" IS NOT NULL),
  ADD CONSTRAINT "aat_payment_attempt_provider_fields_valid"
  CHECK (
    ("provider" = 'PAYSTACK' AND "method" IS DISTINCT FROM 'CASH')
    OR
    ("provider" = 'MANUAL' AND "method" IN ('BANK_TRANSFER', 'POS', 'CASH'))
  ),
  ADD CONSTRAINT "aat_payment_attempt_paystack_success_reference_required"
  CHECK (
    "provider" <> 'PAYSTACK'
    OR "status" <> 'SUCCESSFUL'
    OR ("providerReference" IS NOT NULL AND "gatewayTransactionId" IS NOT NULL)
  ),
  ADD CONSTRAINT "aat_payment_attempt_gateway_data_object"
  CHECK ("redactedGatewayData" IS NULL OR jsonb_typeof("redactedGatewayData") = 'object');

ALTER TABLE "ManualPaymentReview"
  ADD CONSTRAINT "aat_manual_review_hash_valid"
  CHECK ("evidenceSha256" IS NULL OR "evidenceSha256" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "aat_manual_review_evidence_pair_valid"
  CHECK (("evidenceObjectKey" IS NULL) = ("evidenceSha256" IS NULL)),
  ADD CONSTRAINT "aat_manual_review_status_fields_valid"
  CHECK (
    (
      "status" = 'PENDING'
      AND "reviewedByUserId" IS NULL
      AND "reviewedAt" IS NULL
    )
    OR
    (
      "status" IN ('APPROVED', 'REJECTED')
      AND "reviewedByUserId" IS NOT NULL
      AND "reviewedAt" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "aat_manual_review_separation_of_duties"
  CHECK (
    "submittedByUserId" IS NULL
    OR "reviewedByUserId" IS NULL
    OR "submittedByUserId" <> "reviewedByUserId"
  );

ALTER TABLE "Refund"
  ADD CONSTRAINT "aat_refund_amount_positive"
  CHECK ("amountKobo" > 0),
  ADD CONSTRAINT "aat_refund_currency_ngn"
  CHECK ("currency" = 'NGN'),
  ADD CONSTRAINT "aat_refund_idempotency_hash_valid"
  CHECK ("idempotencyKeyHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "aat_refund_approval_separation"
  CHECK ("approvedByUserId" IS NULL OR "approvedByUserId" <> "requestedByUserId"),
  ADD CONSTRAINT "aat_refund_status_timestamps"
  CHECK (
    (
      "status" = 'REQUESTED'
      AND "approvedByUserId" IS NULL
      AND "approvedAt" IS NULL
    )
    OR
    (
      "status" IN ('APPROVED', 'PENDING', 'PROCESSING', 'NEEDS_ATTENTION', 'SUCCEEDED')
      AND "approvedByUserId" IS NOT NULL
      AND "approvedAt" IS NOT NULL
    )
    OR "status" IN ('FAILED', 'CANCELLED')
  ),
  ADD CONSTRAINT "aat_refund_terminal_timestamp_valid"
  CHECK (
    ("status" <> 'SUCCEEDED' OR "processedAt" IS NOT NULL)
    AND ("status" <> 'FAILED' OR "failedAt" IS NOT NULL)
    AND ("status" <> 'CANCELLED' OR "cancelledAt" IS NOT NULL)
  );

ALTER TABLE "PaymentDispute"
  ADD CONSTRAINT "aat_dispute_amount_positive"
  CHECK ("amountKobo" > 0),
  ADD CONSTRAINT "aat_dispute_currency_ngn"
  CHECK ("currency" = 'NGN'),
  ADD CONSTRAINT "aat_dispute_evidence_pair_valid"
  CHECK (("evidenceObjectKey" IS NULL) = ("evidenceSha256" IS NULL)),
  ADD CONSTRAINT "aat_dispute_evidence_hash_valid"
  CHECK ("evidenceSha256" IS NULL OR "evidenceSha256" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "aat_dispute_deadline_valid"
  CHECK ("responseDueAt" IS NULL OR "responseDueAt" >= "openedAt"),
  ADD CONSTRAINT "aat_dispute_resolution_time_valid"
  CHECK (
    "status" NOT IN ('WON', 'LOST', 'ACCEPTED', 'EXPIRED')
    OR "resolvedAt" IS NOT NULL
  );

ALTER TABLE "PaymentWebhookEvent"
  ADD CONSTRAINT "aat_webhook_event_hashes_valid"
  CHECK (
    "deduplicationKey" ~ '^[0-9a-f]{64}$'
    AND "payloadSha256" ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT "aat_webhook_event_one_resource_max"
  CHECK (num_nonnulls("paymentAttemptId", "refundId", "disputeId") <= 1),
  ADD CONSTRAINT "aat_webhook_event_payload_object"
  CHECK ("redactedPayload" IS NULL OR jsonb_typeof("redactedPayload") = 'object'),
  ADD CONSTRAINT "aat_webhook_event_attempts_nonnegative"
  CHECK ("processingAttempts" >= 0),
  ADD CONSTRAINT "aat_webhook_event_status_timestamps"
  CHECK (
    ("status" <> 'PROCESSING' OR "lockedAt" IS NOT NULL)
    AND ("status" <> 'PROCESSED' OR "processedAt" IS NOT NULL)
    AND ("status" NOT IN ('FAILED', 'DEAD_LETTER') OR "failedAt" IS NOT NULL)
  );

ALTER TABLE "PaymentAnomaly"
  ADD CONSTRAINT "aat_payment_anomaly_has_subject"
  CHECK (num_nonnulls("paymentId", "paymentAttemptId", "refundId", "disputeId") >= 1),
  ADD CONSTRAINT "aat_payment_anomaly_details_object"
  CHECK ("details" IS NULL OR jsonb_typeof("details") = 'object'),
  ADD CONSTRAINT "aat_payment_anomaly_resolution_valid"
  CHECK (
    ("status" IN ('RESOLVED', 'IGNORED') AND "resolvedAt" IS NOT NULL AND "resolvedByUserId" IS NOT NULL)
    OR ("status" IN ('OPEN', 'INVESTIGATING') AND "resolvedAt" IS NULL)
  );

ALTER TABLE "PaymentLedgerEntry"
  ADD CONSTRAINT "aat_payment_ledger_amount_positive"
  CHECK ("amountKobo" > 0),
  ADD CONSTRAINT "aat_payment_ledger_currency_ngn"
  CHECK ("currency" = 'NGN'),
  ADD CONSTRAINT "aat_payment_ledger_source_matches_type"
  CHECK (
    ("type" = 'CAPTURE' AND "direction" = 'CREDIT' AND "paymentAttemptId" IS NOT NULL AND "refundId" IS NULL AND "disputeId" IS NULL)
    OR ("type" = 'REFUND' AND "direction" = 'DEBIT' AND "paymentAttemptId" IS NULL AND "refundId" IS NOT NULL AND "disputeId" IS NULL)
    OR ("type" = 'CHARGEBACK' AND "direction" = 'DEBIT' AND "paymentAttemptId" IS NULL AND "refundId" IS NULL AND "disputeId" IS NOT NULL)
    OR ("type" = 'REVERSAL' AND "direction" = 'DEBIT' AND "paymentAttemptId" IS NOT NULL AND "refundId" IS NULL AND "disputeId" IS NULL)
  );

ALTER TABLE "PaymentReconciliationRun"
  ADD CONSTRAINT "aat_reconciliation_period_valid"
  CHECK ("periodStart" < "periodEnd"),
  ADD CONSTRAINT "aat_reconciliation_counts_nonnegative"
  CHECK ("matchedCount" >= 0 AND "differenceCount" >= 0),
  ADD CONSTRAINT "aat_reconciliation_totals_nonnegative"
  CHECK ("providerTotalKobo" >= 0 AND "internalTotalKobo" >= 0),
  ADD CONSTRAINT "aat_reconciliation_completion_valid"
  CHECK ("status" = 'RUNNING' OR "completedAt" IS NOT NULL);

ALTER TABLE "PaymentReconciliationItem"
  ADD CONSTRAINT "aat_reconciliation_item_one_local_source_max"
  CHECK (num_nonnulls("paymentAttemptId", "refundId", "disputeId") <= 1),
  ADD CONSTRAINT "aat_reconciliation_item_has_reference"
  CHECK (
    num_nonnulls("paymentAttemptId", "refundId", "disputeId") = 1
    OR "providerReference" IS NOT NULL
  ),
  ADD CONSTRAINT "aat_reconciliation_item_amounts_nonnegative"
  CHECK (
    ("providerAmountKobo" IS NULL OR "providerAmountKobo" >= 0)
    AND ("internalAmountKobo" IS NULL OR "internalAmountKobo" >= 0)
  );

-- Attempts always inherit their amount/currency from the server-created
-- Payment. After the first attempt exists, the payable target and amount are
-- frozen; changing them requires a new Payment intent.
CREATE OR REPLACE FUNCTION aat_validate_payment_attempt_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  payment_amount bigint;
  payment_currency char(3);
BEGIN
  SELECT "amountKobo", "currency"
    INTO payment_amount, payment_currency
    FROM "Payment"
   WHERE "id" = NEW."paymentId"
   FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment does not exist';
  END IF;

  IF NEW."amountKobo" <> payment_amount OR NEW."currency" <> payment_currency THEN
    RAISE EXCEPTION 'Payment attempt amount/currency must match its payment';
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW."paymentId" IS DISTINCT FROM OLD."paymentId"
    OR NEW."amountKobo" IS DISTINCT FROM OLD."amountKobo"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."internalReference" IS DISTINCT FROM OLD."internalReference"
    OR NEW."provider" IS DISTINCT FROM OLD."provider"
  ) THEN
    RAISE EXCEPTION 'Payment attempt identity is immutable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "PaymentAttempt_validate_identity" ON "PaymentAttempt";
CREATE TRIGGER "PaymentAttempt_validate_identity"
BEFORE INSERT OR UPDATE OF "paymentId", "amountKobo", "currency", "internalReference", "provider"
ON "PaymentAttempt"
FOR EACH ROW
EXECUTE FUNCTION aat_validate_payment_attempt_identity();

CREATE OR REPLACE FUNCTION aat_freeze_payment_after_attempt()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    NEW."amountKobo" IS DISTINCT FROM OLD."amountKobo"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."orderId" IS DISTINCT FROM OLD."orderId"
    OR NEW."invoiceId" IS DISTINCT FROM OLD."invoiceId"
    OR NEW."vehicleTransactionId" IS DISTINCT FROM OLD."vehicleTransactionId"
    OR NEW."purpose" IS DISTINCT FROM OLD."purpose"
  ) AND EXISTS (
    SELECT 1 FROM "PaymentAttempt" WHERE "paymentId" = OLD."id" LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Payment amount and target are immutable after the first attempt';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Payment_freeze_after_attempt" ON "Payment";
CREATE TRIGGER "Payment_freeze_after_attempt"
BEFORE UPDATE OF "amountKobo", "currency", "orderId", "invoiceId", "vehicleTransactionId", "purpose"
ON "Payment"
FOR EACH ROW
EXECUTE FUNCTION aat_freeze_payment_after_attempt();

-- A payment can only settle from one of its own successful, independently
-- verified, exact-amount attempts. Manual attempts also need an approved review.
CREATE OR REPLACE FUNCTION aat_validate_payment_settlement()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  attempt_row "PaymentAttempt"%ROWTYPE;
BEGIN
  IF OLD."settledAttemptId" IS NOT NULL
     AND NEW."settledAttemptId" IS DISTINCT FROM OLD."settledAttemptId" THEN
    RAISE EXCEPTION 'A settled payment attempt is immutable';
  END IF;

  IF NEW."settledAttemptId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
    INTO attempt_row
    FROM "PaymentAttempt"
   WHERE "id" = NEW."settledAttemptId"
     AND "paymentId" = NEW."id"
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Settled attempt must belong to the payment';
  END IF;

  IF attempt_row."status" <> 'SUCCESSFUL'
     OR attempt_row."verificationStatus" <> 'VERIFIED'
     OR attempt_row."verifiedAt" IS NULL THEN
    RAISE EXCEPTION 'Only a successful verified attempt may settle a payment';
  END IF;

  IF attempt_row."amountKobo" <> NEW."amountKobo"
     OR attempt_row."currency" <> NEW."currency"
     OR attempt_row."verifiedAmountKobo" <> NEW."amountKobo"
     OR attempt_row."verifiedCurrency" <> NEW."currency" THEN
    RAISE EXCEPTION 'Settled attempt amount/currency must exactly match the payment';
  END IF;

  IF attempt_row."provider" = 'MANUAL' AND NOT EXISTS (
    SELECT 1
      FROM "ManualPaymentReview" r
     WHERE r."paymentAttemptId" = attempt_row."id"
       AND r."status" = 'APPROVED'
       AND r."reviewedByUserId" IS NOT NULL
       AND r."reviewedAt" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Manual payment must be approved before settlement';
  END IF;

  IF NEW."status" <> 'SUCCEEDED' OR NEW."succeededAt" IS NULL THEN
    RAISE EXCEPTION 'Settled payment must be marked SUCCEEDED with succeededAt';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Payment_validate_settlement" ON "Payment";
CREATE TRIGGER "Payment_validate_settlement"
BEFORE UPDATE OF "settledAttemptId", "status", "succeededAt", "amountKobo", "currency"
ON "Payment"
FOR EACH ROW
EXECUTE FUNCTION aat_validate_payment_settlement();

-- Once a payment succeeds, its financial identity and settlement cannot change.
CREATE OR REPLACE FUNCTION aat_protect_succeeded_payment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" = 'SUCCEEDED' AND (
    NEW."status" IS DISTINCT FROM OLD."status"
    OR NEW."amountKobo" IS DISTINCT FROM OLD."amountKobo"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."orderId" IS DISTINCT FROM OLD."orderId"
    OR NEW."invoiceId" IS DISTINCT FROM OLD."invoiceId"
    OR NEW."vehicleTransactionId" IS DISTINCT FROM OLD."vehicleTransactionId"
    OR NEW."purpose" IS DISTINCT FROM OLD."purpose"
    OR NEW."settledAttemptId" IS DISTINCT FROM OLD."settledAttemptId"
    OR NEW."succeededAt" IS DISTINCT FROM OLD."succeededAt"
  ) THEN
    RAISE EXCEPTION 'Succeeded payment financial fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Payment_protect_succeeded" ON "Payment";
CREATE TRIGGER "Payment_protect_succeeded"
BEFORE UPDATE ON "Payment"
FOR EACH ROW
EXECUTE FUNCTION aat_protect_succeeded_payment();

-- Successful gateway facts stay immutable. A refund/reversal/dispute is a new
-- row and ledger entry; it must not rewrite the original capture.
CREATE OR REPLACE FUNCTION aat_protect_successful_attempt()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" = 'SUCCESSFUL' AND (
    NEW."paymentId" IS DISTINCT FROM OLD."paymentId"
    OR NEW."provider" IS DISTINCT FROM OLD."provider"
    OR NEW."internalReference" IS DISTINCT FROM OLD."internalReference"
    OR NEW."providerReference" IS DISTINCT FROM OLD."providerReference"
    OR NEW."gatewayTransactionId" IS DISTINCT FROM OLD."gatewayTransactionId"
    OR NEW."status" IS DISTINCT FROM OLD."status"
    OR NEW."verificationStatus" IS DISTINCT FROM OLD."verificationStatus"
    OR NEW."amountKobo" IS DISTINCT FROM OLD."amountKobo"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."verifiedAmountKobo" IS DISTINCT FROM OLD."verifiedAmountKobo"
    OR NEW."verifiedCurrency" IS DISTINCT FROM OLD."verifiedCurrency"
    OR NEW."paidAt" IS DISTINCT FROM OLD."paidAt"
    OR NEW."verifiedAt" IS DISTINCT FROM OLD."verifiedAt"
  ) THEN
    RAISE EXCEPTION 'Successful payment attempt facts are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "PaymentAttempt_protect_successful" ON "PaymentAttempt";
CREATE TRIGGER "PaymentAttempt_protect_successful"
BEFORE UPDATE ON "PaymentAttempt"
FOR EACH ROW
EXECUTE FUNCTION aat_protect_successful_attempt();

-- Lock the captured attempt while calculating refundable exposure. Include
-- in-flight refunds so concurrent requests cannot over-refund.
CREATE OR REPLACE FUNCTION aat_validate_refund_total()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  captured_amount bigint;
  captured_currency char(3);
  committed_refunds bigint;
BEGIN
  IF NEW."status" IN ('FAILED', 'CANCELLED') THEN
    RETURN NEW;
  END IF;

  SELECT "verifiedAmountKobo", "verifiedCurrency"
    INTO captured_amount, captured_currency
    FROM "PaymentAttempt"
   WHERE "id" = NEW."paymentAttemptId"
     AND "status" = 'SUCCESSFUL'
     AND "verificationStatus" = 'VERIFIED'
   FOR UPDATE;

  IF NOT FOUND OR captured_amount IS NULL THEN
    RAISE EXCEPTION 'Refund requires a successful verified payment attempt';
  END IF;

  IF NEW."currency" <> captured_currency THEN
    RAISE EXCEPTION 'Refund currency must match the captured payment';
  END IF;

  SELECT COALESCE(SUM("amountKobo"), 0)
    INTO committed_refunds
    FROM "Refund"
   WHERE "paymentAttemptId" = NEW."paymentAttemptId"
     AND "id" <> NEW."id"
     AND "status" NOT IN ('FAILED', 'CANCELLED');

  IF committed_refunds + NEW."amountKobo" > captured_amount THEN
    RAISE EXCEPTION 'Refund total exceeds captured payment amount';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Refund_validate_total" ON "Refund";
CREATE TRIGGER "Refund_validate_total"
BEFORE INSERT OR UPDATE OF "paymentAttemptId", "amountKobo", "currency", "status"
ON "Refund"
FOR EACH ROW
EXECUTE FUNCTION aat_validate_refund_total();

CREATE OR REPLACE FUNCTION aat_protect_succeeded_refund()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" = 'SUCCEEDED' AND (
    NEW."paymentAttemptId" IS DISTINCT FROM OLD."paymentAttemptId"
    OR NEW."amountKobo" IS DISTINCT FROM OLD."amountKobo"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."providerRefundId" IS DISTINCT FROM OLD."providerRefundId"
    OR NEW."status" IS DISTINCT FROM OLD."status"
    OR NEW."processedAt" IS DISTINCT FROM OLD."processedAt"
  ) THEN
    RAISE EXCEPTION 'Succeeded refund financial fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Refund_protect_succeeded" ON "Refund";
CREATE TRIGGER "Refund_protect_succeeded"
BEFORE UPDATE ON "Refund"
FOR EACH ROW
EXECUTE FUNCTION aat_protect_succeeded_refund();

-- Confirm an optional Payment.customerId does not contradict the payable owner.
CREATE OR REPLACE FUNCTION aat_validate_payment_customer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_customer uuid;
BEGIN
  IF NEW."customerId" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW."orderId" IS NOT NULL THEN
    SELECT "customerId" INTO target_customer FROM "Order" WHERE "id" = NEW."orderId";
  ELSIF NEW."invoiceId" IS NOT NULL THEN
    SELECT "customerId" INTO target_customer FROM "Invoice" WHERE "id" = NEW."invoiceId";
  ELSE
    SELECT "customerId" INTO target_customer
      FROM "VehicleTransaction"
     WHERE "id" = NEW."vehicleTransactionId";
  END IF;

  IF target_customer IS NOT NULL AND target_customer <> NEW."customerId" THEN
    RAISE EXCEPTION 'Payment customer does not own the payable target';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Payment_validate_customer" ON "Payment";
CREATE TRIGGER "Payment_validate_customer"
BEFORE INSERT OR UPDATE OF "customerId", "orderId", "invoiceId", "vehicleTransactionId"
ON "Payment"
FOR EACH ROW
EXECUTE FUNCTION aat_validate_payment_customer();

-- ---------------------------------------------------------------------------
-- Vehicle inventory, marketplace, transactions and handover
-- ---------------------------------------------------------------------------

ALTER TABLE "Vehicle"
  ADD CONSTRAINT "aat_vehicle_year_valid"
  CHECK ("year" BETWEEN 1886 AND 2100),
  ADD CONSTRAINT "aat_vehicle_mileage_nonnegative"
  CHECK ("mileageKm" IS NULL OR "mileageKm" >= 0),
  ADD CONSTRAINT "aat_vehicle_doors_positive"
  CHECK ("doors" IS NULL OR "doors" > 0),
  ADD CONSTRAINT "aat_vehicle_seats_positive"
  CHECK ("seats" IS NULL OR "seats" > 0),
  ADD CONSTRAINT "aat_vehicle_acquisition_cost_nonnegative"
  CHECK ("acquisitionCostKobo" IS NULL OR "acquisitionCostKobo" >= 0),
  ADD CONSTRAINT "aat_vehicle_acquisition_currency_ngn"
  CHECK ("acquisitionCurrency" = 'NGN'),
  ADD CONSTRAINT "aat_vehicle_vin_format"
  CHECK (
    "vin" IS NULL
    OR upper("vin") ~ '^[A-HJ-NPR-Z0-9]{17}$'
  ),
  ADD CONSTRAINT "aat_vehicle_stock_number_not_blank"
  CHECK (btrim("stockNumber") <> '');

ALTER TABLE "VehicleListing"
  ADD CONSTRAINT "aat_vehicle_listing_price_positive"
  CHECK ("priceKobo" > 0),
  ADD CONSTRAINT "aat_vehicle_listing_currency_ngn"
  CHECK ("currency" = 'NGN'),
  ADD CONSTRAINT "aat_vehicle_listing_status_timestamps"
  CHECK (
    ("status" <> 'AVAILABLE' OR "publishedAt" IS NOT NULL)
    AND ("status" <> 'RESERVED' OR "reservedAt" IS NOT NULL)
    AND ("status" <> 'SOLD' OR "soldAt" IS NOT NULL)
    AND ("status" <> 'ARCHIVED' OR "archivedAt" IS NOT NULL)
  );

-- A physical vehicle may retain historical listings, but only one listing may
-- be publicly active/reserved at once.
CREATE UNIQUE INDEX "VehicleListing_one_live_per_vehicle"
  ON "VehicleListing" ("vehicleId")
  WHERE "status" IN ('AVAILABLE', 'RESERVED');

ALTER TABLE "VehicleImage"
  ADD CONSTRAINT "aat_vehicle_image_sort_nonnegative"
  CHECK ("sortOrder" >= 0),
  ADD CONSTRAINT "aat_vehicle_image_hash_valid"
  CHECK ("checksumSha256" IS NULL OR "checksumSha256" ~ '^[0-9a-f]{64}$');

CREATE UNIQUE INDEX "VehicleImage_one_primary_per_vehicle"
  ON "VehicleImage" ("vehicleId")
  WHERE "isPrimary" = true;

ALTER TABLE "VehiclePriceHistory"
  ADD CONSTRAINT "aat_vehicle_price_history_amounts_positive"
  CHECK ("oldPriceKobo" > 0 AND "newPriceKobo" > 0),
  ADD CONSTRAINT "aat_vehicle_price_history_changed"
  CHECK ("oldPriceKobo" <> "newPriceKobo"),
  ADD CONSTRAINT "aat_vehicle_price_history_currency_ngn"
  CHECK ("currency" = 'NGN');

ALTER TABLE "VehicleDocument"
  ADD CONSTRAINT "aat_vehicle_document_size_positive"
  CHECK ("sizeBytes" > 0),
  ADD CONSTRAINT "aat_vehicle_document_hash_valid"
  CHECK ("checksumSha256" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "aat_vehicle_document_expiry_valid"
  CHECK ("expiresAt" IS NULL OR "issuedAt" IS NULL OR "expiresAt" > "issuedAt"),
  ADD CONSTRAINT "aat_vehicle_document_review_valid"
  CHECK (
    ("verificationStatus" = 'PENDING' AND "verifiedAt" IS NULL)
    OR ("verificationStatus" = 'VERIFIED' AND "verifiedAt" IS NOT NULL AND "reviewedByStaffId" IS NOT NULL)
    OR ("verificationStatus" = 'REJECTED' AND "reviewedByStaffId" IS NOT NULL AND "rejectionReason" IS NOT NULL)
  );

ALTER TABLE "VehicleConditionReport"
  ADD CONSTRAINT "aat_vehicle_report_odometer_nonnegative"
  CHECK ("odometerKm" IS NULL OR "odometerKm" >= 0),
  ADD CONSTRAINT "aat_vehicle_report_score_valid"
  CHECK ("conditionScore" IS NULL OR "conditionScore" BETWEEN 0 AND 100),
  ADD CONSTRAINT "aat_vehicle_report_findings_object"
  CHECK ("findings" IS NULL OR jsonb_typeof("findings") = 'object'),
  ADD CONSTRAINT "aat_vehicle_report_asset_pair_valid"
  CHECK (("reportObjectKey" IS NULL) = ("reportSha256" IS NULL)),
  ADD CONSTRAINT "aat_vehicle_report_hash_valid"
  CHECK ("reportSha256" IS NULL OR "reportSha256" ~ '^[0-9a-f]{64}$');

ALTER TABLE "InspectionRequest"
  ADD CONSTRAINT "aat_inspection_preferred_window_valid"
  CHECK ("preferredEndAt" IS NULL OR "preferredEndAt" > "preferredStartAt"),
  ADD CONSTRAINT "aat_inspection_scheduled_window_valid"
  CHECK (
    ("scheduledStartAt" IS NULL) = ("scheduledEndAt" IS NULL)
    AND ("scheduledEndAt" IS NULL OR "scheduledEndAt" > "scheduledStartAt")
  ),
  ADD CONSTRAINT "aat_inspection_status_timestamps"
  CHECK (
    ("status" <> 'CONFIRMED' OR ("confirmedAt" IS NOT NULL AND "scheduledStartAt" IS NOT NULL))
    AND ("status" <> 'COMPLETED' OR "completedAt" IS NOT NULL)
    AND ("status" <> 'CANCELLED' OR ("cancelledAt" IS NOT NULL AND "cancellationReason" IS NOT NULL))
  );

ALTER TABLE "VehicleTransaction"
  ADD CONSTRAINT "aat_vehicle_transaction_prices_valid"
  CHECK (
    "askingPriceKobo" > 0
    AND ("agreedPriceKobo" IS NULL OR "agreedPriceKobo" > 0)
    AND ("reservationRequiredKobo" IS NULL OR "reservationRequiredKobo" > 0)
    AND (
      "reservationRequiredKobo" IS NULL
      OR "agreedPriceKobo" IS NULL
      OR "reservationRequiredKobo" <= "agreedPriceKobo"
    )
  ),
  ADD CONSTRAINT "aat_vehicle_transaction_currency_ngn"
  CHECK ("currency" = 'NGN'),
  ADD CONSTRAINT "aat_vehicle_transaction_version_nonnegative"
  CHECK ("version" >= 0),
  ADD CONSTRAINT "aat_vehicle_transaction_agreed_price_required"
  CHECK (
    "status" NOT IN ('PAYMENT_PENDING', 'RESERVED', 'PARTIALLY_PAID', 'PAID', 'HANDOVER_PENDING', 'COMPLETED')
    OR "agreedPriceKobo" IS NOT NULL
  ),
  ADD CONSTRAINT "aat_vehicle_transaction_terms_required"
  CHECK (
    "status" NOT IN ('PAYMENT_PENDING', 'RESERVED', 'PARTIALLY_PAID', 'PAID', 'HANDOVER_PENDING', 'COMPLETED')
    OR ("termsVersion" IS NOT NULL AND "termsAcceptedAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "aat_vehicle_transaction_status_timestamps"
  CHECK (
    ("status" <> 'PAID' OR "paidAt" IS NOT NULL)
    AND ("status" <> 'HANDOVER_PENDING' OR "handoverPendingAt" IS NOT NULL)
    AND ("status" <> 'COMPLETED' OR "completedAt" IS NOT NULL)
    AND ("status" <> 'CANCELLED' OR ("cancelledAt" IS NOT NULL AND "cancellationReason" IS NOT NULL))
    AND ("status" <> 'EXPIRED' OR "expiredAt" IS NOT NULL)
  );

-- The reservation flow must lock VehicleListing first, then create/update the
-- transaction. This index is the final race-condition backstop.
CREATE UNIQUE INDEX "VehicleTransaction_one_committed_buyer_per_listing"
  ON "VehicleTransaction" ("vehicleListingId")
  WHERE "status" IN (
    'PAYMENT_PENDING',
    'RESERVED',
    'PARTIALLY_PAID',
    'PAID',
    'HANDOVER_PENDING'
  );

CREATE OR REPLACE FUNCTION aat_freeze_vehicle_price_after_payment_attempt()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    NEW."agreedPriceKobo" IS DISTINCT FROM OLD."agreedPriceKobo"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."vehicleListingId" IS DISTINCT FROM OLD."vehicleListingId"
    OR NEW."customerId" IS DISTINCT FROM OLD."customerId"
  ) AND EXISTS (
    SELECT 1
      FROM "Payment" p
      JOIN "PaymentAttempt" a ON a."paymentId" = p."id"
     WHERE p."vehicleTransactionId" = OLD."id"
     LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Vehicle deal price and buyer are immutable after a payment attempt';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "VehicleTransaction_freeze_after_payment_attempt" ON "VehicleTransaction";
CREATE TRIGGER "VehicleTransaction_freeze_after_payment_attempt"
BEFORE UPDATE OF "agreedPriceKobo", "currency", "vehicleListingId", "customerId"
ON "VehicleTransaction"
FOR EACH ROW
EXECUTE FUNCTION aat_freeze_vehicle_price_after_payment_attempt();

ALTER TABLE "VehicleTransactionStatusHistory"
  ADD CONSTRAINT "aat_vehicle_status_history_changed"
  CHECK ("fromStatus" IS NULL OR "fromStatus" <> "toStatus");

ALTER TABLE "VehicleHandover"
  ADD CONSTRAINT "aat_vehicle_handover_values_valid"
  CHECK (
    ("odometerKm" IS NULL OR "odometerKm" >= 0)
    AND "keysDelivered" >= 0
  ),
  ADD CONSTRAINT "aat_vehicle_handover_asset_pair_valid"
  CHECK (("signedDocumentObjectKey" IS NULL) = ("signedDocumentSha256" IS NULL)),
  ADD CONSTRAINT "aat_vehicle_handover_hash_valid"
  CHECK ("signedDocumentSha256" IS NULL OR "signedDocumentSha256" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "aat_vehicle_handover_status_timestamps"
  CHECK (
    ("status" <> 'READY' OR "readyAt" IS NOT NULL)
    AND (
      "status" <> 'COMPLETED'
      OR (
        "completedAt" IS NOT NULL
        AND "recipientName" IS NOT NULL
        AND "recipientPhone" IS NOT NULL
        AND "signedDocumentObjectKey" IS NOT NULL
      )
    )
    AND ("status" <> 'CANCELLED' OR "cancelledAt" IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- Polymorphic business records
-- ---------------------------------------------------------------------------

ALTER TABLE "Review"
  ADD CONSTRAINT "aat_review_rating_valid"
  CHECK ("rating" BETWEEN 1 AND 5),
  ADD CONSTRAINT "aat_review_target_valid"
  CHECK (
    ("targetType" = 'BUSINESS' AND num_nonnulls("serviceId", "bookingId", "orderId", "vehicleTransactionId") = 0)
    OR ("targetType" = 'SERVICE' AND "serviceId" IS NOT NULL AND num_nonnulls("bookingId", "orderId", "vehicleTransactionId") = 0)
    OR ("targetType" = 'ORDER' AND "orderId" IS NOT NULL AND num_nonnulls("serviceId", "bookingId", "vehicleTransactionId") = 0)
    OR ("targetType" = 'VEHICLE_TRANSACTION' AND "vehicleTransactionId" IS NOT NULL AND num_nonnulls("serviceId", "bookingId", "orderId") = 0)
  );

ALTER TABLE "Enquiry"
  ADD CONSTRAINT "aat_enquiry_target_valid"
  CHECK (
    ("type" = 'GENERAL' AND num_nonnulls("productId", "serviceId", "bookingId", "quoteId", "vehicleListingId") = 0)
    OR ("type" = 'PRODUCT' AND "productId" IS NOT NULL AND num_nonnulls("serviceId", "bookingId", "quoteId", "vehicleListingId") = 0)
    OR ("type" = 'SERVICE' AND "serviceId" IS NOT NULL AND num_nonnulls("productId", "bookingId", "quoteId", "vehicleListingId") = 0)
    OR ("type" = 'BOOKING' AND "bookingId" IS NOT NULL AND num_nonnulls("productId", "serviceId", "quoteId", "vehicleListingId") = 0)
    OR ("type" = 'VEHICLE' AND "vehicleListingId" IS NOT NULL AND num_nonnulls("productId", "serviceId", "bookingId", "quoteId") = 0)
    OR (
      "type" = 'QUOTATION'
      AND num_nonnulls("serviceId", "quoteId") = 1
      AND num_nonnulls("productId", "bookingId", "vehicleListingId") = 0
    )
  ),
  ADD CONSTRAINT "aat_enquiry_resolution_valid"
  CHECK ("status" NOT IN ('RESOLVED', 'CLOSED') OR "resolvedAt" IS NOT NULL);

ALTER TABLE "Promotion"
  ADD CONSTRAINT "aat_promotion_discount_shape_valid"
  CHECK (
    ("discountType" = 'PERCENTAGE' AND "percentageBasisPoints" BETWEEN 1 AND 10000 AND "fixedAmountKobo" IS NULL)
    OR ("discountType" = 'FIXED_AMOUNT' AND "fixedAmountKobo" > 0 AND "percentageBasisPoints" IS NULL)
  ),
  ADD CONSTRAINT "aat_promotion_amounts_nonnegative"
  CHECK (
    ("minimumOrderAmountKobo" IS NULL OR "minimumOrderAmountKobo" >= 0)
    AND ("maximumDiscountAmountKobo" IS NULL OR "maximumDiscountAmountKobo" > 0)
  ),
  ADD CONSTRAINT "aat_promotion_limits_positive"
  CHECK (
    ("usageLimit" IS NULL OR "usageLimit" > 0)
    AND ("perCustomerLimit" IS NULL OR "perCustomerLimit" > 0)
    AND ("usageLimit" IS NULL OR "perCustomerLimit" IS NULL OR "perCustomerLimit" <= "usageLimit")
  ),
  ADD CONSTRAINT "aat_promotion_window_valid"
  CHECK ("startsAt" < "endsAt");

ALTER TABLE "PromotionUsage"
  ADD CONSTRAINT "aat_promotion_usage_snapshot_valid"
  CHECK (
    ("discountTypeSnapshot" = 'PERCENTAGE' AND "percentageBasisPointsSnapshot" BETWEEN 1 AND 10000 AND "fixedAmountKoboSnapshot" IS NULL)
    OR ("discountTypeSnapshot" = 'FIXED_AMOUNT' AND "fixedAmountKoboSnapshot" > 0 AND "percentageBasisPointsSnapshot" IS NULL)
  ),
  ADD CONSTRAINT "aat_promotion_usage_amount_positive"
  CHECK ("discountAmountKobo" > 0);

ALTER TABLE "Invoice"
  ADD CONSTRAINT "aat_invoice_exactly_one_source"
  CHECK (num_nonnulls("orderId", "bookingId", "vehicleTransactionId") = 1),
  ADD CONSTRAINT "aat_invoice_currency_ngn"
  CHECK ("currency" = 'NGN'),
  ADD CONSTRAINT "aat_invoice_amounts_valid"
  CHECK (
    "subtotalKobo" >= 0
    AND "taxKobo" >= 0
    AND "totalKobo" = "subtotalKobo" + "taxKobo"
  ),
  ADD CONSTRAINT "aat_invoice_due_date_valid"
  CHECK ("dueAt" IS NULL OR "issuedAt" IS NULL OR "dueAt" >= "issuedAt"),
  ADD CONSTRAINT "aat_invoice_status_timestamps"
  CHECK (
    ("status" <> 'ISSUED' OR "issuedAt" IS NOT NULL)
    AND ("status" <> 'PAID' OR "paidAt" IS NOT NULL)
    AND ("status" <> 'VOID' OR "voidedAt" IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION aat_protect_issued_quote()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" <> 'DRAFT' AND (
    NEW."bookingId" IS DISTINCT FROM OLD."bookingId"
    OR NEW."version" IS DISTINCT FROM OLD."version"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."subtotalKobo" IS DISTINCT FROM OLD."subtotalKobo"
    OR NEW."taxKobo" IS DISTINCT FROM OLD."taxKobo"
    OR NEW."totalKobo" IS DISTINCT FROM OLD."totalKobo"
  ) THEN
    RAISE EXCEPTION 'Issued quote amounts are immutable; create a new version';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION aat_protect_issued_invoice()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" <> 'DRAFT' AND (
    NEW."customerId" IS DISTINCT FROM OLD."customerId"
    OR NEW."orderId" IS DISTINCT FROM OLD."orderId"
    OR NEW."bookingId" IS DISTINCT FROM OLD."bookingId"
    OR NEW."vehicleTransactionId" IS DISTINCT FROM OLD."vehicleTransactionId"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."subtotalKobo" IS DISTINCT FROM OLD."subtotalKobo"
    OR NEW."taxKobo" IS DISTINCT FROM OLD."taxKobo"
    OR NEW."totalKobo" IS DISTINCT FROM OLD."totalKobo"
  ) THEN
    RAISE EXCEPTION 'Issued invoice amounts are immutable; void and replace it';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "ServiceQuote_protect_issued" ON "ServiceQuote";
CREATE TRIGGER "ServiceQuote_protect_issued"
BEFORE UPDATE ON "ServiceQuote"
FOR EACH ROW EXECUTE FUNCTION aat_protect_issued_quote();

DROP TRIGGER IF EXISTS "Invoice_protect_issued" ON "Invoice";
CREATE TRIGGER "Invoice_protect_issued"
BEFORE UPDATE ON "Invoice"
FOR EACH ROW EXECUTE FUNCTION aat_protect_issued_invoice();

ALTER TABLE "IdempotencyRecord"
  ADD CONSTRAINT "aat_idempotency_hashes_valid"
  CHECK ("keyHash" ~ '^[0-9a-f]{64}$' AND "requestHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "aat_idempotency_expiry_valid"
  CHECK ("expiresAt" > "createdAt"),
  ADD CONSTRAINT "aat_idempotency_response_status_valid"
  CHECK ("responseStatus" IS NULL OR "responseStatus" BETWEEN 100 AND 599),
  ADD CONSTRAINT "aat_idempotency_completion_valid"
  CHECK (
    ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL AND "responseStatus" IS NOT NULL)
    OR "status" IN ('IN_PROGRESS', 'FAILED')
  );

ALTER TABLE "OutboxEvent"
  ADD CONSTRAINT "aat_outbox_attempts_nonnegative"
  CHECK ("attempts" >= 0),
  ADD CONSTRAINT "aat_outbox_payload_object"
  CHECK (jsonb_typeof("payload") = 'object'),
  ADD CONSTRAINT "aat_outbox_status_timestamps"
  CHECK (
    ("status" <> 'PROCESSING' OR "lockedAt" IS NOT NULL)
    AND ("status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- Immutability guards for audit/financial history
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION aat_forbid_update_or_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% rows are append-only', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS "AuditLog_append_only" ON "AuditLog";
CREATE TRIGGER "AuditLog_append_only"
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION aat_forbid_update_or_delete();

DROP TRIGGER IF EXISTS "PaymentLedgerEntry_append_only" ON "PaymentLedgerEntry";
CREATE TRIGGER "PaymentLedgerEntry_append_only"
BEFORE UPDATE OR DELETE ON "PaymentLedgerEntry"
FOR EACH ROW EXECUTE FUNCTION aat_forbid_update_or_delete();

DROP TRIGGER IF EXISTS "VehiclePriceHistory_append_only" ON "VehiclePriceHistory";
CREATE TRIGGER "VehiclePriceHistory_append_only"
BEFORE UPDATE OR DELETE ON "VehiclePriceHistory"
FOR EACH ROW EXECUTE FUNCTION aat_forbid_update_or_delete();

DROP TRIGGER IF EXISTS "VehicleTransactionStatusHistory_append_only" ON "VehicleTransactionStatusHistory";
CREATE TRIGGER "VehicleTransactionStatusHistory_append_only"
BEFORE UPDATE OR DELETE ON "VehicleTransactionStatusHistory"
FOR EACH ROW EXECUTE FUNCTION aat_forbid_update_or_delete();

DROP TRIGGER IF EXISTS "InventoryTransaction_append_only" ON "InventoryTransaction";
CREATE TRIGGER "InventoryTransaction_append_only"
BEFORE UPDATE OR DELETE ON "InventoryTransaction"
FOR EACH ROW EXECUTE FUNCTION aat_forbid_update_or_delete();

-- Financial/transaction records may be updated through their lifecycle, but
-- must never be physically deleted. Use cancellation, expiry, refund, dispute,
-- revocation, or PII anonymization according to the retention policy.
CREATE OR REPLACE FUNCTION aat_forbid_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% rows cannot be physically deleted', TG_TABLE_NAME;
END;
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Payment',
    'PaymentAttempt',
    'ManualPaymentReview',
    'Refund',
    'PaymentDispute',
    'PaymentWebhookEvent',
    'PaymentAnomaly',
    'PaymentReconciliationRun',
    'PaymentReconciliationItem',
    'VehicleTransaction',
    'VehicleHandover',
    'Invoice',
    'Order',
    'OrderItem',
    'ServiceQuote',
    'QuoteItem',
    'WorkOrder',
    'WorkOrderItem'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', table_name || '_forbid_delete', table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION aat_forbid_delete()',
      table_name || '_forbid_delete',
      table_name
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Foreign-key index audit. PostgreSQL does not create indexes for FKs.
-- This query must return zero rows after Prisma's indexes and the custom
-- indexes above are applied. Add a workload-appropriate index for any result.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  missing_count integer;
BEGIN
  SELECT count(*)
    INTO missing_count
    FROM pg_constraint c
   WHERE c.contype = 'f'
     AND c.connamespace = 'public'::regnamespace
     AND NOT EXISTS (
       SELECT 1
         FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND i.indisvalid
          AND i.indkey::smallint[] @> c.conkey
     );

  IF missing_count > 0 THEN
    RAISE NOTICE 'Foreign-key index audit found % candidate(s). Run IMPLEMENTATION.md audit query and review them.', missing_count;
  END IF;
END;
$$;
