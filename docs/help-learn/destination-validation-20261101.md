# Help destination validation checkpoint

The client now accepts the existing service-category, booking, aftercare, refund,
dispute, privacy and finance-policy article destinations. Allie retrieval accepts
the existing service-category destination. Published article text and versions are
unchanged; this repairs delivery of already authorised guidance, not new eligibility.

Acceptance: 71 backend focused tests and 38 frontend focused tests passed, plus
390/1440 rendered fixtures covering all seven destinations through article selection
and refresh. Public/customer/staff without the required duties cannot retrieve
owner-service-groups. Unknown/external/script destinations remain rejected.
Published runtime 6de6c86f is live on apex/www with backend d496ecda. Two hosted
390/1440 Help fixtures and four live public journeys passed. Chrome public article
open/refresh passed; signed-in staff acceptance remains unverified because Chrome
shows Sign In. Existing AI, practice and guide activation requirements remain
authoritative. No paid provider call or customer submission occurred.
