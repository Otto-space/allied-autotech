-- EnableExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'STAFF', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ServicePricingType" AS ENUM ('FIXED', 'QUOTE_REQUIRED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FulfillmentMethod" AS ENUM ('COLLECTION', 'DELIVERY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED', 'ABANDONED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('PAYSTACK', 'MANUAL');

-- CreateEnum
CREATE TYPE "VehicleListingStatus" AS ENUM ('DRAFT', 'AVAILABLE', 'RESERVED', 'SOLD', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewTargetType" AS ENUM ('BUSINESS', 'SERVICE', 'ORDER');

-- CreateEnum
CREATE TYPE "EnquiryType" AS ENUM ('GENERAL', 'PRODUCT', 'VEHICLE', 'SERVICE', 'BOOKING', 'QUOTATION');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ComplaintPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BOOKING', 'ORDER', 'PAYMENT', 'INSPECTION', 'ENQUIRY', 'COMPLAINT', 'REVIEW', 'PROMOTION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "Transmission" AS ENUM ('AUTOMATIC', 'MANUAL', 'CVT', 'OTHER');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC', 'OTHER');

-- CreateEnum
CREATE TYPE "VehicleCondition" AS ENUM ('NEW', 'USED');

-- CreateEnum
CREATE TYPE "BodyType" AS ENUM ('SEDAN', 'SUV', 'COUPE', 'HATCHBACK', 'WAGON', 'PICKUP', 'VAN', 'TRUCK', 'BUS', 'OTHER');

-- CreateEnum
CREATE TYPE "DriveType" AS ENUM ('FWD', 'RWD', 'AWD', 'FOUR_WD', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PASSWORD_RESET', 'EMAIL_VERIFIED', 'ROLE_CHANGE', 'ACCOUNT_SUSPENDED', 'ACCOUNT_DEACTIVATED', 'SESSION_REVOKED', 'STATUS_CHANGE', 'INVENTORY_ADJUSTED', 'PAYMENT_VERIFIED', 'PAYMENT_REFUNDED');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('USER', 'SESSION', 'CUSTOMER_PROFILE', 'STAFF_PROFILE', 'CUSTOMER_VEHICLE', 'SERVICE', 'BOOKING', 'PRODUCT', 'INVENTORY', 'ORDER', 'PAYMENT', 'VEHICLE_LISTING', 'INSPECTION', 'REVIEW', 'ENQUIRY', 'COMPLAINT', 'PROMOTION', 'INVOICE');

-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('STOCK_IN', 'SALE', 'RESERVATION', 'RESERVATION_RELEASE', 'RETURN', 'ADJUSTMENT', 'DAMAGE', 'RESTOCK');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "ipAddress" INET,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "action" "AuditAction" NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT,
    "requestId" VARCHAR(100),
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" INET,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" VARCHAR(32),
    "jobTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "phoneVerifiedAt" TIMESTAMP(3),
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Nigeria',
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerVehicle" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "registrationNumber" TEXT,
    "vin" TEXT,
    "color" TEXT,
    "mileage" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "shortDescription" TEXT,
    "pricingType" "ServicePricingType" NOT NULL DEFAULT 'FIXED',
    "price" DECIMAL(12,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NGN',
    "durationMinutes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "vehicleId" UUID,
    "assignedStaffId" UUID,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "quotedPrice" DECIMAL(12,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NGN',
    "customerNotes" TEXT,
    "staffNotes" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "brand" TEXT,
    "manufacturerPartNumber" TEXT,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NGN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCompatibility" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT,
    "yearFrom" INTEGER,
    "yearTo" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" UUID NOT NULL,
    "inventoryId" UUID NOT NULL,
    "type" "InventoryTransactionType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFavourite" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductFavourite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" UUID NOT NULL,
    "cartId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "fulfillmentMethod" "FulfillmentMethod" NOT NULL DEFAULT 'COLLECTION',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NGN',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deliveryFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" CITEXT NOT NULL,
    "customerPhone" VARCHAR(32) NOT NULL,
    "deliveryName" TEXT,
    "deliveryPhone" VARCHAR(32),
    "deliveryAddress" TEXT,
    "deliveryCity" TEXT,
    "deliveryState" TEXT,
    "deliveryCountry" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paymentDueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "processingAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "productName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "reference" VARCHAR(120) NOT NULL,
    "gatewayTransactionId" VARCHAR(120),
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NGN',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "gateway" "PaymentGateway" NOT NULL DEFAULT 'PAYSTACK',
    "verifiedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "gatewayResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" UUID NOT NULL,
    "paymentId" UUID,
    "eventId" VARCHAR(160) NOT NULL,
    "eventType" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleListing" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "mileage" INTEGER,
    "price" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NGN',
    "transmission" "Transmission",
    "fuelType" "FuelType",
    "condition" "VehicleCondition" NOT NULL DEFAULT 'USED',
    "bodyType" "BodyType",
    "engineSize" TEXT,
    "driveType" "DriveType",
    "color" TEXT,
    "doors" INTEGER,
    "seats" INTEGER,
    "description" TEXT,
    "status" "VehicleListingStatus" NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "registrationNumber" TEXT,
    "vin" TEXT,
    "publishedAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleImage" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionRequest" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "assignedStaffId" UUID,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "status" "InspectionStatus" NOT NULL DEFAULT 'REQUESTED',
    "notes" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "InspectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedVehicle" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "targetType" "ReviewTargetType" NOT NULL,
    "serviceId" UUID,
    "bookingId" UUID,
    "orderId" UUID,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enquiry" (
    "id" UUID NOT NULL,
    "customerId" UUID,
    "productId" UUID,
    "serviceId" UUID,
    "vehicleId" UUID,
    "assignedStaffId" UUID,
    "type" "EnquiryType" NOT NULL,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'OPEN',
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "phone" VARCHAR(32),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" UUID NOT NULL,
    "customerId" UUID,
    "bookingId" UUID,
    "orderId" UUID,
    "assignedStaffId" UUID,
    "priority" "ComplaintPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "name" TEXT,
    "email" CITEXT,
    "phone" VARCHAR(32),
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" CITEXT,
    "description" TEXT,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" DECIMAL(12,2) NOT NULL,
    "minimumOrderAmount" DECIMAL(12,2),
    "maximumDiscountAmount" DECIMAL(12,2),
    "usageLimit" INTEGER,
    "perCustomerLimit" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionUsage" (
    "id" UUID NOT NULL,
    "promotionId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "promotionCodeSnapshot" CITEXT,
    "discountTypeSnapshot" "DiscountType" NOT NULL,
    "discountValueSnapshot" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "orderId" UUID,
    "bookingId" UUID,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NGN',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_lockedUntil_idx" ON "User"("lockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Session_revokedAt_idx" ON "Session"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_userId_key" ON "StaffProfile"("userId");

-- CreateIndex
CREATE INDEX "StaffProfile_jobTitle_idx" ON "StaffProfile"("jobTitle");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_userId_key" ON "CustomerProfile"("userId");

-- CreateIndex
CREATE INDEX "CustomerProfile_phone_idx" ON "CustomerProfile"("phone");

-- CreateIndex
CREATE INDEX "CustomerProfile_state_idx" ON "CustomerProfile"("state");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerVehicle_vin_key" ON "CustomerVehicle"("vin");

-- CreateIndex
CREATE INDEX "CustomerVehicle_customerId_idx" ON "CustomerVehicle"("customerId");

-- CreateIndex
CREATE INDEX "CustomerVehicle_registrationNumber_idx" ON "CustomerVehicle"("registrationNumber");

-- CreateIndex
CREATE INDEX "CustomerVehicle_make_model_idx" ON "CustomerVehicle"("make", "model");

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

-- CreateIndex
CREATE INDEX "Service_isActive_idx" ON "Service"("isActive");

-- CreateIndex
CREATE INDEX "Service_pricingType_isActive_idx" ON "Service"("pricingType", "isActive");

-- CreateIndex
CREATE INDEX "Booking_serviceId_idx" ON "Booking"("serviceId");

-- CreateIndex
CREATE INDEX "Booking_vehicleId_idx" ON "Booking"("vehicleId");

-- CreateIndex
CREATE INDEX "Booking_status_scheduledAt_idx" ON "Booking"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Booking_assignedStaffId_status_scheduledAt_idx" ON "Booking"("assignedStaffId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Booking_customerId_status_idx" ON "Booking"("customerId", "status");

-- CreateIndex
CREATE INDEX "Booking_customerId_createdAt_idx" ON "Booking"("customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_isActive_idx" ON "Category"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_manufacturerPartNumber_key" ON "Product"("manufacturerPartNumber");

-- CreateIndex
CREATE INDEX "Product_categoryId_isActive_idx" ON "Product"("categoryId", "isActive");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Product_brand_idx" ON "Product"("brand");

-- CreateIndex
CREATE INDEX "Product_featured_isActive_idx" ON "Product"("featured", "isActive");

-- CreateIndex
CREATE INDEX "ProductCompatibility_productId_idx" ON "ProductCompatibility"("productId");

-- CreateIndex
CREATE INDEX "ProductCompatibility_make_model_idx" ON "ProductCompatibility"("make", "model");

-- CreateIndex
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_productId_key" ON "Inventory"("productId");

-- CreateIndex
CREATE INDEX "Inventory_quantity_idx" ON "Inventory"("quantity");

-- CreateIndex
CREATE INDEX "InventoryTransaction_inventoryId_createdAt_idx" ON "InventoryTransaction"("inventoryId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryTransaction_type_idx" ON "InventoryTransaction"("type");

-- CreateIndex
CREATE INDEX "InventoryTransaction_referenceType_referenceId_idx" ON "InventoryTransaction"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "ProductFavourite_productId_idx" ON "ProductFavourite"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductFavourite_customerId_productId_key" ON "ProductFavourite"("customerId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_customerId_key" ON "Cart"("customerId");

-- CreateIndex
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_key" ON "CartItem"("cartId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_gatewayTransactionId_key" ON "Payment"("gatewayTransactionId");

-- CreateIndex
CREATE INDEX "Payment_orderId_status_idx" ON "Payment"("orderId", "status");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_eventId_key" ON "PaymentWebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_paymentId_idx" ON "PaymentWebhookEvent"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_eventType_idx" ON "PaymentWebhookEvent"("eventType");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_createdAt_idx" ON "PaymentWebhookEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleListing_slug_key" ON "VehicleListing"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleListing_vin_key" ON "VehicleListing"("vin");

-- CreateIndex
CREATE INDEX "VehicleListing_status_make_model_idx" ON "VehicleListing"("status", "make", "model");

-- CreateIndex
CREATE INDEX "VehicleListing_status_year_idx" ON "VehicleListing"("status", "year");

-- CreateIndex
CREATE INDEX "VehicleListing_status_price_idx" ON "VehicleListing"("status", "price");

-- CreateIndex
CREATE INDEX "VehicleListing_featured_status_idx" ON "VehicleListing"("featured", "status");

-- CreateIndex
CREATE INDEX "VehicleImage_vehicleId_sortOrder_idx" ON "VehicleImage"("vehicleId", "sortOrder");

-- CreateIndex
CREATE INDEX "InspectionRequest_customerId_requestedAt_idx" ON "InspectionRequest"("customerId", "requestedAt");

-- CreateIndex
CREATE INDEX "InspectionRequest_vehicleId_idx" ON "InspectionRequest"("vehicleId");

-- CreateIndex
CREATE INDEX "InspectionRequest_status_requestedAt_idx" ON "InspectionRequest"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "InspectionRequest_assignedStaffId_status_idx" ON "InspectionRequest"("assignedStaffId", "status");

-- CreateIndex
CREATE INDEX "SavedVehicle_vehicleId_idx" ON "SavedVehicle"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedVehicle_customerId_vehicleId_key" ON "SavedVehicle"("customerId", "vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_orderId_key" ON "Review"("orderId");

-- CreateIndex
CREATE INDEX "Review_customerId_createdAt_idx" ON "Review"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_serviceId_idx" ON "Review"("serviceId");

-- CreateIndex
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Enquiry_customerId_idx" ON "Enquiry"("customerId");

-- CreateIndex
CREATE INDEX "Enquiry_vehicleId_idx" ON "Enquiry"("vehicleId");

-- CreateIndex
CREATE INDEX "Enquiry_type_status_idx" ON "Enquiry"("type", "status");

-- CreateIndex
CREATE INDEX "Enquiry_status_createdAt_idx" ON "Enquiry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Enquiry_assignedStaffId_status_idx" ON "Enquiry"("assignedStaffId", "status");

-- CreateIndex
CREATE INDEX "Complaint_customerId_idx" ON "Complaint"("customerId");

-- CreateIndex
CREATE INDEX "Complaint_bookingId_idx" ON "Complaint"("bookingId");

-- CreateIndex
CREATE INDEX "Complaint_orderId_idx" ON "Complaint"("orderId");

-- CreateIndex
CREATE INDEX "Complaint_status_priority_createdAt_idx" ON "Complaint"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "Complaint_assignedStaffId_status_idx" ON "Complaint"("assignedStaffId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");

-- CreateIndex
CREATE INDEX "Promotion_isActive_startsAt_endsAt_idx" ON "Promotion"("isActive", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionUsage_orderId_key" ON "PromotionUsage"("orderId");

-- CreateIndex
CREATE INDEX "PromotionUsage_promotionId_idx" ON "PromotionUsage"("promotionId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_bookingId_key" ON "Invoice"("bookingId");

-- CreateIndex
CREATE INDEX "Invoice_customerId_createdAt_idx" ON "Invoice"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_expiresAt_idx" ON "Notification"("expiresAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerVehicle" ADD CONSTRAINT "CustomerVehicle_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "CustomerVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFavourite" ADD CONSTRAINT "ProductFavourite_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFavourite" ADD CONSTRAINT "ProductFavourite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleImage" ADD CONSTRAINT "VehicleImage_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "VehicleListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRequest" ADD CONSTRAINT "InspectionRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRequest" ADD CONSTRAINT "InspectionRequest_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "VehicleListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRequest" ADD CONSTRAINT "InspectionRequest_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedVehicle" ADD CONSTRAINT "SavedVehicle_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedVehicle" ADD CONSTRAINT "SavedVehicle_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "VehicleListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "VehicleListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionUsage" ADD CONSTRAINT "PromotionUsage_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionUsage" ADD CONSTRAINT "PromotionUsage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "User_email_ci_key" ON "User" (LOWER("email"));
CREATE UNIQUE INDEX "Promotion_code_ci_key" ON "Promotion" (LOWER("code")) WHERE "code" IS NOT NULL;
ALTER TABLE "User"
  ADD CONSTRAINT "User_failedLoginAttempts_nonnegative" CHECK ("failedLoginAttempts" >= 0);

ALTER TABLE "CustomerVehicle"
  ADD CONSTRAINT "CustomerVehicle_year_valid" CHECK ("year" >= 1886 AND "year" <= 2100),
  ADD CONSTRAINT "CustomerVehicle_mileage_nonnegative" CHECK ("mileage" IS NULL OR "mileage" >= 0);

ALTER TABLE "Service"
  ADD CONSTRAINT "Service_price_nonnegative" CHECK ("price" IS NULL OR "price" >= 0),
  ADD CONSTRAINT "Service_duration_positive" CHECK ("durationMinutes" IS NULL OR "durationMinutes" > 0),
  ADD CONSTRAINT "Service_pricing_consistent" CHECK (("pricingType" = 'FIXED' AND "price" IS NOT NULL) OR ("pricingType" = 'QUOTE_REQUIRED'));

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_quotedPrice_nonnegative" CHECK ("quotedPrice" IS NULL OR "quotedPrice" >= 0);

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_price_nonnegative" CHECK ("price" >= 0);

ALTER TABLE "ProductCompatibility"
  ADD CONSTRAINT "ProductCompatibility_yearFrom_valid" CHECK ("yearFrom" IS NULL OR ("yearFrom" >= 1886 AND "yearFrom" <= 2100)),
  ADD CONSTRAINT "ProductCompatibility_yearTo_valid" CHECK ("yearTo" IS NULL OR ("yearTo" >= 1886 AND "yearTo" <= 2100)),
  ADD CONSTRAINT "ProductCompatibility_year_range_valid" CHECK ("yearFrom" IS NULL OR "yearTo" IS NULL OR "yearTo" >= "yearFrom");

ALTER TABLE "ProductImage"
  ADD CONSTRAINT "ProductImage_sortOrder_nonnegative" CHECK ("sortOrder" >= 0);

ALTER TABLE "Inventory"
  ADD CONSTRAINT "Inventory_quantity_nonnegative" CHECK ("quantity" >= 0),
  ADD CONSTRAINT "Inventory_reserved_nonnegative" CHECK ("reserved" >= 0),
  ADD CONSTRAINT "Inventory_reserved_not_above_quantity" CHECK ("reserved" <= "quantity"),
  ADD CONSTRAINT "Inventory_reorderLevel_nonnegative" CHECK ("reorderLevel" >= 0);

ALTER TABLE "InventoryTransaction"
  ADD CONSTRAINT "InventoryTransaction_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_subtotal_nonnegative" CHECK ("subtotal" >= 0),
  ADD CONSTRAINT "Order_discount_nonnegative" CHECK ("discountAmount" >= 0),
  ADD CONSTRAINT "Order_deliveryFee_nonnegative" CHECK ("deliveryFee" >= 0),
  ADD CONSTRAINT "Order_total_nonnegative" CHECK ("total" >= 0),
  ADD CONSTRAINT "Order_discount_not_above_charges" CHECK ("discountAmount" <= ("subtotal" + "deliveryFee")),
  ADD CONSTRAINT "Order_total_consistent" CHECK ("total" = ("subtotal" + "deliveryFee" - "discountAmount")),
  ADD CONSTRAINT "Order_delivery_details_required" CHECK (
    "fulfillmentMethod" = 'COLLECTION'
    OR ("deliveryName" IS NOT NULL AND "deliveryPhone" IS NOT NULL AND "deliveryAddress" IS NOT NULL AND "deliveryCity" IS NOT NULL AND "deliveryState" IS NOT NULL AND "deliveryCountry" IS NOT NULL)
  );

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "OrderItem_unitPrice_nonnegative" CHECK ("unitPrice" >= 0),
  ADD CONSTRAINT "OrderItem_subtotal_nonnegative" CHECK ("subtotal" >= 0),
  ADD CONSTRAINT "OrderItem_subtotal_consistent" CHECK ("subtotal" = ("unitPrice" * "quantity"));

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amount_positive" CHECK ("amount" > 0);

CREATE UNIQUE INDEX "Payment_one_successful_per_order"
  ON "Payment" ("orderId")
  WHERE "status" = 'SUCCESSFUL';

ALTER TABLE "VehicleListing"
  ADD CONSTRAINT "VehicleListing_year_valid" CHECK ("year" >= 1886 AND "year" <= 2100),
  ADD CONSTRAINT "VehicleListing_mileage_nonnegative" CHECK ("mileage" IS NULL OR "mileage" >= 0),
  ADD CONSTRAINT "VehicleListing_price_positive" CHECK ("price" > 0),
  ADD CONSTRAINT "VehicleListing_doors_valid" CHECK ("doors" IS NULL OR ("doors" >= 1 AND "doors" <= 10)),
  ADD CONSTRAINT "VehicleListing_seats_valid" CHECK ("seats" IS NULL OR ("seats" >= 1 AND "seats" <= 100));

ALTER TABLE "VehicleImage"
  ADD CONSTRAINT "VehicleImage_sortOrder_nonnegative" CHECK ("sortOrder" >= 0);

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5),
  ADD CONSTRAINT "Review_target_consistent" CHECK (
    ("targetType" = 'BUSINESS' AND "serviceId" IS NULL AND "bookingId" IS NULL AND "orderId" IS NULL)
    OR ("targetType" = 'SERVICE' AND "serviceId" IS NOT NULL AND "bookingId" IS NOT NULL AND "orderId" IS NULL)
    OR ("targetType" = 'ORDER' AND "serviceId" IS NULL AND "bookingId" IS NULL AND "orderId" IS NOT NULL)
  );

ALTER TABLE "Complaint"
  ADD CONSTRAINT "Complaint_contact_required" CHECK ("customerId" IS NOT NULL OR "email" IS NOT NULL);

ALTER TABLE "Promotion"
  ADD CONSTRAINT "Promotion_discount_positive" CHECK ("discountValue" > 0),
  ADD CONSTRAINT "Promotion_dates_valid" CHECK ("endsAt" > "startsAt"),
  ADD CONSTRAINT "Promotion_percentage_valid" CHECK ("discountType" <> 'PERCENTAGE' OR "discountValue" <= 100),
  ADD CONSTRAINT "Promotion_minimumOrder_nonnegative" CHECK ("minimumOrderAmount" IS NULL OR "minimumOrderAmount" >= 0),
  ADD CONSTRAINT "Promotion_maximumDiscount_positive" CHECK ("maximumDiscountAmount" IS NULL OR "maximumDiscountAmount" > 0),
  ADD CONSTRAINT "Promotion_usageLimit_positive" CHECK ("usageLimit" IS NULL OR "usageLimit" > 0),
  ADD CONSTRAINT "Promotion_perCustomerLimit_positive" CHECK ("perCustomerLimit" IS NULL OR "perCustomerLimit" > 0);

ALTER TABLE "PromotionUsage"
  ADD CONSTRAINT "PromotionUsage_discountValue_positive" CHECK ("discountValueSnapshot" > 0),
  ADD CONSTRAINT "PromotionUsage_discountAmount_nonnegative" CHECK ("discountAmount" >= 0);

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_subtotal_nonnegative" CHECK ("subtotal" >= 0),
  ADD CONSTRAINT "Invoice_tax_nonnegative" CHECK ("tax" >= 0),
  ADD CONSTRAINT "Invoice_total_nonnegative" CHECK ("total" >= 0),
  ADD CONSTRAINT "Invoice_total_consistent" CHECK ("total" = ("subtotal" + "tax")),
  ADD CONSTRAINT "Invoice_exactly_one_source" CHECK (num_nonnulls("orderId", "bookingId") = 1);
