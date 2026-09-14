export type ApiMeta = { requestId: string };

export type FieldErrors = Record<string, string[]>;

export type ApiErrorBody = {
  success: false;
  message: string;
  error: { code: string; fields?: FieldErrors };
  meta?: ApiMeta;
};

export type ApiSuccess<T> = {
  success: true;
  message: string;
  data?: T;
  meta: ApiMeta;
};

export type Page<T> = { items: T[]; nextCursor?: string };

export type Branch = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string;
  city: string;
  state: string;
  country: string;
};

export type Service = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  pricingType: "FIXED" | "QUOTE_REQUIRED";
  priceKobo: string | null;
  currency: "NGN";
  durationMinutes: number | null;
  version: number;
};

export type BookingPolicy = import("zod").infer<
  typeof import("./booking-schemas").bookingPolicySchema
>;

export type BookingSlot = {
  id: string;
  branchId: string;
  serviceId: string;
  startsAt: string;
  endsAt: string;
  version: number;
  branch: Pick<Branch, "id" | "code" | "name">;
  service: Pick<Service, "id" | "name" | "priceKobo" | "currency" | "durationMinutes">;
};

export type SessionUser = { id: string; email: string; role: string };
export type SessionState = {
  user: SessionUser;
  id: string;
  mfaRequired: boolean;
  mfaVerifiedAt: string | null;
  expiresAt: string;
  idleExpiresAt: string;
};

export type Booking = {
  id: string;
  status: string;
  scheduledAt: string | null;
  version: number;
  depositAmountKobo: string | null;
  paymentHoldExpiresAt: string | null;
  depositPaidAt: string | null;
  customerRescheduleCount: number;
  service: Service;
  branch: Pick<Branch, "id" | "code" | "name">;
  depositPayment: Payment | null;
};

export type Payment = {
  id: string;
  paymentNumber: string;
  amountKobo: string;
  currency: "NGN";
  status: string;
  expiresAt: string | null;
};

export type Notification = {
  id: string;
  type: string;
  category: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

export type Review = {
  id: string;
  targetType: string;
  rating: number;
  title: string | null;
  comment: string;
  status: string;
  createdAt: string;
};

export type SupportThread = {
  id: string;
  subject: string;
  status: string;
  version: number;
  createdAt: string;
};

export type SupportMessage = {
  id: string;
  authorType: "CUSTOMER" | "STAFF" | "SYSTEM";
  visibility: string;
  body: string;
  createdAt: string;
};
