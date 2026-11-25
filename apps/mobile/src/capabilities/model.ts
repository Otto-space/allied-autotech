import { z } from "zod";
const enabled = z.object({ enabled: z.boolean() });
export const capabilitiesSchema = z
  .object({
    scope: z.literal("POLICY_SUMMARY"),
    serverTime: z.iso.datetime(),
    release: z.object({
      mode: z.enum(["full", "browse_enquiries", "catalogue"]),
      customerAccountsEnabled: z.boolean(),
      enquiriesEnabled: z.boolean(),
      bookingRequestsEnabled: z.boolean(),
      inspectionRequestsEnabled: z.boolean(),
    }),
    checkoutEnabled: z.boolean(),
    collection: enabled.extend({ address: z.string() }),
    delivery: enabled,
    vehicleDeposits: enabled,
    finance: z.object({
      approvalStatus: z.string().nullable(),
      draftVatBasisPoints: z.number().int().nonnegative(),
      pricesIncludeVat: z.literal(false),
    }),
    booking: z.object({
      confirmation: z.literal("STAFF_REVIEW"),
      cancellationFeeKobo: z.string().regex(/^\d+$/),
      reminderMinutes: z.number().int().nonnegative(),
    }),
    marketing: enabled,
    destructiveRetention: enabled,
  })
  .superRefine((value, context) => {
    const { mode } = value.release;
    if (
      value.release.customerAccountsEnabled !== (mode !== "catalogue") ||
      value.release.enquiriesEnabled !== (mode !== "catalogue") ||
      (mode !== "full" &&
        (value.release.bookingRequestsEnabled ||
          value.release.inspectionRequestsEnabled ||
          value.checkoutEnabled ||
          value.vehicleDeposits.enabled)) ||
      (value.vehicleDeposits.enabled && !value.checkoutEnabled)
    )
      context.addIssue({ code: "custom", message: "Availability could not be verified" });
  });
export type Capabilities = z.infer<typeof capabilitiesSchema>;
export const canCreateAccount = (value: Capabilities | null) =>
  value?.release.customerAccountsEnabled === true;
export const canSendEnquiry = (value: Capabilities | null) =>
  value?.release.enquiriesEnabled === true;
export const canRequestBooking = (value: Capabilities | null) =>
  value?.release.bookingRequestsEnabled === true;
export const canRequestInspection = (value: Capabilities | null) =>
  value?.release.inspectionRequestsEnabled === true;
export const canCheckout = (value: Capabilities | null) =>
  value?.checkoutEnabled === true;
// No Allie capability is supplied by this endpoint. Never infer it from marketing or launch mode.
export const canUseAllie = (_value: Capabilities | null) => false;
