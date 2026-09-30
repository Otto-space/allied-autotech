-- Prefix expression indexes require no new PostgreSQL extension. No records change.
CREATE INDEX "User_customer_directory_created_idx" ON "User" ("createdAt", "id") WHERE "role" = 'CUSTOMER';
CREATE INDEX "User_customer_directory_email_idx" ON "User" (lower("email"::text) text_pattern_ops) WHERE "role" = 'CUSTOMER';
CREATE INDEX "CustomerProfile_directory_name_idx" ON "CustomerProfile" (lower(regexp_replace(trim("firstName" || ' ' || "lastName"), '\s+', ' ', 'g')) text_pattern_ops);
CREATE INDEX "CustomerProfile_directory_surname_idx" ON "CustomerProfile" (lower("lastName") text_pattern_ops);
CREATE INDEX "CustomerProfile_directory_phone_idx" ON "CustomerProfile" (regexp_replace("phone", '[^0-9]', '', 'g') text_pattern_ops);
CREATE INDEX "CustomerVehicle_directory_idx" ON "CustomerVehicle" ("customerId", "id");
CREATE INDEX "Booking_directory_idx" ON "Booking" ("customerId", "id");
CREATE INDEX "Order_directory_idx" ON "Order" ("customerId", "id");
CREATE INDEX "Payment_directory_idx" ON "Payment" ("customerId", "id");
CREATE INDEX "Enquiry_directory_idx" ON "Enquiry" ("customerId", "id");
CREATE INDEX "Complaint_directory_idx" ON "Complaint" ("customerId", "id");
