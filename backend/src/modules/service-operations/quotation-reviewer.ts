// An owner may delegate preparation and approval separately, but a staff
// member must never approve a quote authored under their own staff profile.
export function isIndependentQuotationReviewer(
  reviewerStaffId: string | null,
  authorStaffId: string,
) {
  return reviewerStaffId !== null && reviewerStaffId !== authorStaffId;
}
