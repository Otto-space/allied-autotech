export interface RequestSecurityContext {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}
