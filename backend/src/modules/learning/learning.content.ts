// Backend-owned corpus. Never import this module into frontend code.
export type LearningGate =
  | "public"
  | "customer"
  | "work"
  | "care"
  | "sales"
  | "finance"
  | "refunds"
  | "disputes"
  | "privacy"
  | "financial-policy"
  | "booking-confirmation"
  | "financial-aftercare"
  | "jobs"
  | "assign"
  | "operations"
  | "oversight"
  | "admin"
  | "vehicle-admin"
  | "access"
  | "owner";
export type LearningPage =
  "home" | "parts" | "vehicles" | "customer-care" | "staff-care" | "work" | "other";
export const learningTargets = [
  "parts-search",
  "parts-results",
  "support-start",
  "support-subject",
  "care-search",
  "care-results",
] as const;
export type LearningTarget = (typeof learningTargets)[number];
export interface LearningArticle {
  id: string;
  title: string;
  summary: string;
  prerequisites: string;
  steps: string[];
  outcome: string;
  recovery: string;
  keywords: string;
  gate: LearningGate;
  page: LearningPage;
  href: string;
  source: string;
  version: number;
  status: "published" | "draft";
  reviewedAt: string;
}
const article = (
  id: string,
  gate: LearningGate,
  page: LearningPage,
  title: string,
  summary: string,
  steps: string[],
  href: string,
  source: string,
  keywords = "",
  prerequisites = "Use only the actions available to your current account.",
): LearningArticle => ({
  id,
  gate,
  page,
  title,
  summary,
  steps,
  href,
  source,
  keywords,
  prerequisites,
  outcome:
    "You understand the next permitted step. Reading help does not change a live record.",
  recovery:
    gate === "public" || gate === "customer"
      ? "If the required control is unavailable, refresh your access or use Contact support. Do not bypass a restriction or repeat an uncertain submission."
      : "If the required work control is unavailable, refresh your access or ask an authorised access manager. No internal escalation link is supplied here. Do not forward staff guidance to public Contact or Customer Care, bypass restrictions or repeat an uncertain submission.",
  version: gate === "public" || gate === "customer" ? 2 : 3,
  status: "published",
  reviewedAt: gate === "public" || gate === "customer" ? "2026-10-26" : "2026-10-27",
});
export const learningArticles: LearningArticle[] = [
  {
    ...article(
      "parts-collection",
      "customer",
      "parts",
      "Use a private parts pickup code",
      "Authorise collection for one ready order without exposing your other records.",
      [
        "Holding lasts five collection days, Monday-Saturday including public holidays, after both actual readiness and successful customer notification. Imported/custom parts follow the same rule. A failed contact attempt does not start the clock. Check the saved Collect by date and any reasoned extension; overdue does not cancel paid goods, charge storage fees or release allocation.",
        "Open the actual ready order and Collect your parts. Choose quantities, review them and confirm. The server checks readiness and verified financial clearance; payment alone is not collection authority.",
        "After Care records a verified refund and reviews the affected goods, collection shows only the goods still owed. Goods already collected keep their own history, and the original order amount and refund record stay visible. Create and privately share a fresh code for the remaining goods; unused old codes are revoked. The workshop checks the actual goods and current financial clearance. If no goods remain, ask Care to confirm financial closure rather than requesting a pickup.",
        "After authorised Care records financial closure, No goods outstanding shows the actual collected and refunded quantities. Original amounts and refund history remain. Retained payment is historical coverage, not another amount to pay or replacement credit. Financial closure does not mean another pickup occurred.",
        "The code is shown once. Copy it before choosing Hide code, refreshing or reloading. Share it privately only with your chosen collector. Its security expiry is separate from the collection holding period. Replacing or revoking an unused code does not cancel the order or move money.",
        "If staff have begun a pickup review, ask the workshop to resolve it before replacing the code. A review is not handover. Each physical pickup consumes its code; exact remaining goods need a new code.",
        "For an uncertain result, reopen the same order and inspect its history. Do not request a second physical handover. A public order number never authorises collection.",
        "A cancelled original order may show No captured payment recorded or Captured funds returned after Care reviews its actual payment evidence. No captured payment recorded is not a refund or a promise that no bank debit occurred; report a debit to Care. The original stays cancelled, no pickup is invented, and a suitable alternative still needs your separate acceptance, checks and payment.",
      ],
      "/dashboard/orders",
      "OrderPickupService buyer ownership and private one-time authorisation",
      "parts pickup collection private code remaining quantities",
    ),
    version: 6,
    reviewedAt: "2026-11-13",
  },
  {
    ...article(
      "staff-parts-collection",
      "work",
      "work",
      "Review and record physical parts collection",
      "Use a current branch-authorised, session-bound review before recording actual handover.",
      [
        "Holding lasts five collection days, Monday-Saturday including public holidays, after both actual readiness and successful customer notification. Imported/custom parts follow the same rule. A failed contact attempt does not start the clock. Check the saved Collect by date and any reasoned extension; overdue does not cancel paid goods, charge storage fees or release allocation.",
        "Open the actual ready order and Physical parts collection. Current verified staff access and actual branch scope are required. Enter the private code and exact goods for this pickup. Check actual goods and authority; omit ID numbers or copies from notes.",
        "Review pickup authorisation and confirm. The review is exclusively bound to your current session. Another operator must not release the same goods. Financial proof and remaining quantities are checked again; a review never marks goods collected.",
        "After actual supply settlement and goods review, exclude only the verified refunded unfulfilled positions. Previously collected goods keep their history. Check the current remaining-goods list and financial proof; an original gross amount is not another payment due. A cancelled unpaid replacement does not undo its actual original refund. No-goods financial closure belongs with authorised Care and financial review, never a zero-quantity handover.",
        "Only after the listed goods have physically been handed over, enter the collector name and verification note, confirm that physical fact and review the handover record. The code is consumed once, immutable history is retained and any partial remainder stays outstanding. This takes no payment and does not consume stock again.",
        "When every original unit is already handed over or verified as refunded and unfulfilled, an assured administrator can Review financial closure after independently settled refunds and current money checks. This records the remaining obligation as closed, not a zero-quantity handover. Keep actual earlier pickups and never return consumed goods to stock. An active pickup claim must first be truthfully reconciled.",
        "If no goods have been handed over during a pickup review, the current reviewer or an authorised administrator can resolve the review with a reason and explicit no-handover confirmation. Its code is revoked; the buyer needs a new one. Never confirm no handover if goods may have left. Preserve uncertainty for authorised reconciliation, inspect the same order history and do not hand goods over again.",
        "For an already cancelled original with no recorded handover, authorised Care reviews closed payment intents and full independent return of every actual capture. No captured payment recorded never means a refund was sent. Failed or abandoned attempts alone do not prove no money arrived. Keep uncertain bank evidence, technical disputes and physical uncertainty in review; do not invent a unit allocation or pickup.",
      ],
      "/staff/orders",
      "OrderPickupService current MFA, branch scope, exclusive review claim and immutable handover",
      "staff parts pickup collection exclusive review physical handover",
    ),
    version: 5,
    reviewedAt: "2026-11-13",
  },
  {
    ...article(
      "service-vehicle-collection",
      "admin",
      "work",
      "Review and record vehicle collection",
      "Record collection separately from completed work, using verified current balances and an actual collector review.",
      [
        "Open the completed booking in Bookings. Vehicle collection needs both the booking and work order recorded complete. Current Admin or Super Admin access and verified MFA are required; a technician or booking-reading responsibility alone does not authorise release.",
        "Choose Check collection readiness. The server checks every agreed original and additional invoice, verified materials and workmanship payments, genuine historical credit and financial holds. A payment request or invoice label alone does not prove settlement. Historical invoices without a staged agreement require authorised financial review; do not invent a replacement allocation.",
        "Enter the actual collector name and record the identity and collection-authority review. Keep this note internal and omit ID numbers, copies and payment credentials. Confirm the identity/authority checkbox only after the actual check, then review the exact details.",
        "Explicitly confirm at handover. Current access, booking version and the reviewed financial proof are checked again. A conflict preserves the record for review. This creates one immutable collection record and a booking audit entry, not a charge or another work completion. It does not change inventory or grant anyone financial approval powers.",
        "If the response is uncertain, close the review, refresh the booking and inspect Vehicle collection recorded before handover or another submission. Do not repeat a physical handover. Never invent confirmation from an elapsed countdown or a pending payment. Later financial adjustments retain the historical collection record and need their normal authorised review.",
      ],
      "/admin",
      "Current service collection review, settlement proof and immutable booking-linked collection history",
      "service vehicle collection handover release materials workmanship cleared balance",
    ),
    version: 1,
    reviewedAt: "2026-11-09",
  },

  {
    ...article(
      "work-account-profile",
      "work",
      "work",
      "View your work profile",
      "Find your own recorded identity and account security without changing access.",
      [
        "Open Account options in the dashboard header and choose My profile.",
        "Review the name and email actually recorded for your signed-in account. An absent employee profile does not establish a name or photo.",
        "Use Account security for passwords, MFA and active sessions. Ask an authorised account manager about corrections to work details; this profile view does not grant or change responsibilities.",
      ],
      "/admin/profile",
      "Current own-account projection and security controls",
      "own profile name account identity security",
    ),
    version: 1,
    reviewedAt: "2026-11-03",
  },
  {
    ...article(
      "vehicle-operations",
      "vehicle-admin",
      "work",
      "Maintain vehicle records and asking prices",
      "Admin and Super Admin can maintain vehicle stock, draft listings and asking prices with current verified access. Owner-only controls and separate financial approvals remain restricted.",
      [
        "Open Vehicle stock, choose Add vehicle record and enter the actual branch, stock number and known vehicle details. Preserve unknown values and review before confirming. Engine / Power type, Fuel type, Drive system and Transmission describe separate facts. Engine & drive keeps supplied Engine details (up to 500 characters) separate from precise capacity and known issues. Additional features are individual items, up to 40 with 80 characters each; commas within an item are preserved. Only include equipment supplied for this vehicle. Changing power type never clears other supplied specifications. A stock record does not publish a listing.",
        "Choose View details on a stock row to inspect its facts, or Edit details to open the existing specifications editor. The detail header also offers Edit details. Use the horizontal section links for listings, photos, documents and condition; scroll this row locally when needed. Opening an editor saves nothing. Review changes before explicitly confirming. Saving public vehicle details updates existing listings without creating a listing or changing its status. Create a draft listing with an initial asking price when needed. Use ungrouped NGN or correctly grouped commas, such as 55000000.00 or 55,000,000.00. Review the exact amount before saving.",
        "Use Manage asking price to enter a different amount and reason. Price history records your signed-in account; an employee profile is not required for Admin or Super Admin. Reserved, sold and archived listings retain their committed-price safeguards.",
        "Document review records the reviewing account and the decision. Review the actual evidence; a role does not establish document authenticity. Publishing still requires the normal photo, branch, price and lifecycle checks.",
        "If a record changed, reload and inspect its current version before editing again. For an uncertain response, inspect the recorded state and history before acknowledging it; do not retry automatically or guess a new price.",
      ],
      "/admin/vehicles",
      "VehiclesService role/branch policy and User-attributed price/document audit",
      "vehicle stock create edit draft listing asking price history administrator",
    ),
    version: 3,
    reviewedAt: "2026-11-09",
  },
  {
    ...article(
      "privacy-and-allie",
      "public",
      "other",
      "Understand your privacy and Allie conversations",
      "The published Privacy notice explains how Allied AutoTech uses information, your choices and the limits of clearing help history.",
      [
        "Open the Privacy notice for the current explanation of account, enquiry, technical and support information. Avoid putting personal records, passwords, codes or banking details into help questions or catalogue searches.",
        "If conversational Allie is available and you choose to use it, OpenAI processes your typed question, eligible reviewed instructions and recent help context. Private records, support threads, uploads and form contents are not included. Secret screening can miss sensitive text. Reviewed help remains available without AI.",
        "Active Allie conversation data and temporary reply records are encrypted on our server. They expire after 15 minutes without a completed answer or one hour overall, possibly sooner with your session. Up to six recent turns provide context; conversations are not saved in browser storage.",
        "Clear removes active server history. Removal of expired conversation data depends on scheduled cleanup; backups follow their own policy. We request no stored provider response, but OpenAI abuse-monitoring rules may still apply. Clearing local help does not promise provider deletion.",
        "Opening a contact link does not send your conversation. Signed-in customers separately review and send a Customer Care message; only the selected summary and optional help excerpts are attached. Cancelling a review does not remove a message already saved.",
        "Use the contact details in the Privacy notice to request access, correction, deletion or other applicable privacy choices. Proportionate identity verification may be needed. Legal obligations or documented holds can limit removal; deletion is not instantaneous across every system. Allie cannot inspect or erase your records.",
      ],
      "/privacy",
      "Reviewed published Privacy notice: frontend/app/privacy/page.tsx, Accounts and enquiries version 2, effective 22 October 2026; sections privacy-ai, privacy-browser, privacy-retention and privacy-requests. Review this guidance whenever that notice or the actual storage behaviour changes.",
      "privacy personal information data retention allie conversation history clear delete erase storage openai provider backup notice",
      "You can read the public notice without an account. Optional AI help is available only when the current site configuration enables it.",
    ),
    version: 2,
    reviewedAt: "2026-11-02",
    outcome:
      "You know where to read the current notice and how to ask about your information. Reading help does not submit a privacy request or delete records.",
    recovery:
      "Use the contact details in the Privacy notice for your actual request. Do not send private records through Allie or assume that clearing help deletes a saved support message or provider copies.",
  },
  {
    ...article(
      "owner-service-groups",
      "admin",
      "work",
      "Apply the owner service groups",
      "Review the approved service structure before changing catalogue groups.",
      [
        "Open Service categories and choose Review owner service groups. Administrator access and verified MFA are required.",
        "Review all eight groups. Missing groups will be created and published; existing groups keep their identities, URLs, descriptions and visibility. An inactive group remains hidden until separately reviewed and activated.",
        "Tyre Change is assigned to Tyre & Wheel Maintenance only when it has no group. Prices, duration, bookings and historical records are unchanged. If the service is absent, no replacement service is created.",
        "Open a group and choose Manage group image to upload one genuine relevant photo, edit its description or remove it. Review each change before confirming. Active groups publish their photo; inactive groups keep an administrator-only preview. Without a photo, the group keeps its icon.",
        "To arrange groups, edit a category and set Display order. Lower numbers appear first; ties are alphabetical. Review and confirm the save. Existing groups keep their order when the owner structure is reapplied.",
        "Choose Apply service groups only after reviewing. If records change or associations conflict, refresh the review and resolve the existing record first.",
        "If the result is uncertain, close the review and fetch the current groups again. Reapplying a fresh review does not duplicate groups or repeat an existing assignment.",
      ],
      "/admin/service-categories",
      "ServiceCategoryService owner structure review/apply, CategoryMediaService and ServiceImageEditor, OwnerServiceStructure review UI",
      "service categories groups owner import tyre wheel display order",
    ),
    version: 3,
    reviewedAt: "2026-11-01",
  },
  {
    ...article(
      "business-contact",
      "public",
      "other",
      "Find Allied AutoTech and contact the team",
      "Allied AutoTech is at 133 Stadium Road, beside Kilimanjaro Pizza Jungle Restaurant, Port Harcourt, Rivers State, Nigeria.",
      [
        "Open Contact for directions, email and the Whatsapp link. The published support email is support@alliedautotech.com.",
        "Published customer-care hours are Monday–Saturday, 8am–6pm (Nigeria time). These are customer-care hours, not confirmation of workshop availability or a booked appointment.",
        "Choose Whatsapp on Contact to open the business conversation. Opening the link does not send a message, reserve a visit or guarantee an immediate reply.",
        "For a workshop visit, use the offered booking or enquiry flow and wait for the team's confirmation. Ask the team about any opening-time exception before travelling.",
      ],
      "/contact",
      "Reviewed published Contact information: frontend/lib/business.ts; collection address: backend/src/modules/policies/policies.service.ts. Review this article when those sources change.",
      "address location directions stadium kilimanjaro port harcourt rivers nigeria contact email whatsapp hours opening visit business",
      "You do not need an account to view the public Contact page.",
    ),
    version: 1,
    reviewedAt: "2026-10-30",
    outcome:
      "You can find the business and choose a contact method. Your message or visit still needs its normal explicit action.",
    recovery:
      "If a contact method is unavailable, try another method on Contact. Do not assume that the workshop is open or that an appointment is confirmed.",
  },
  {
    ...article(
      "home-next-step",
      "public",
      "home",
      "Choose your next step with Allied AutoTech",
      "Start with Services for vehicle care, Shop for products and compatibility, or Vehicles for listings and requirements enquiries. The team confirms availability and arrangements separately.",
      [
        "Online actions follow current server availability. If availability cannot be checked, keep your draft, use Check availability again, or contact the team. Opening a direct link does not enable a closed action. Booking availability and checkout availability are checked separately. Appointment requests may be open while purchasing remains closed; an appointment request does not authorise a charge.",
        "Use Search in the public header to search services, products, vehicles and public Help together. Choose a result or View all to refine that catalogue. You can also choose a single catalogue or Help. Search never reads private dashboard records and does not establish availability or compatibility.",
        "Home highlights comprehensive diagnostics, four-wheel alignment and Generic Lube Oil Service. Open the published service to see its current price, or ask the team about scope and pricing. An enquiry does not reserve an appointment.",
        "Use the hero’s Previous, Next and slide controls to explore workshop highlights. Pause stops rotation; keyboard focus also stops it until you explicitly choose Play. Reduced-motion preferences start the slideshow paused.",
        "About includes the complete team photograph, team-at-work photos and workshop equipment. Open an equipment group, then choose a photo for a closer look. Equipment does not establish vehicle eligibility or an appointment guarantee.",
        "Choose Shop to review products, listed branch availability and compatibility. Missing availability or fitment information needs confirmation from the team.",
        "Choose Vehicles to inspect published listings or explain your requirements when no listing suits you. An enquiry is not a reservation.",
        "Use Help & Learn for instructions or Contact to speak to the team. The website guide does not inspect or change your records.",
      ],
      "/services",
      "Home customer routes, catalogue availability contract and approved enquiries launch",
      "home homepage search start services shop products vehicles enquiry",
    ),
    version: 6,
    reviewedAt: "2026-11-02",
  },
  {
    ...article(
      "financial-aftercare",
      "financial-aftercare",
      "work",
      "Review a scoped financial aftercare decision",
      "Financial aftercare requires current finance scope and a separate financial approval grant. A title, payment-reading permission or approval grant alone does not provide another branch's records.",
      [
        "Open Financial aftercare and filter by order reference, request type or status. Open a permitted request and inspect its requested quantities, branch, total and stored policy evidence.",
        "Treat missing or unrecognised item/policy evidence as unknown. An authorised operator must review that evidence; do not invent a policy, fee or inspection. A return needs receipt and inspection before approval.",
        "Choose a financial decision and record an explicit fee, including zero, when approving. Cancellation before order confirmation is free. Explain the monetary basis in the customer-visible note; never copy internal inspection notes or private financial details into it.",
        "Review the order, branch, decision, fee and Customer-visible audience before explicitly recording the decision. The server rechecks current scope/grant and the evidence revision. This does not cancel the order, restock goods, initiate a refund or mark money received.",
        "For a lost or unverified response, do not retry automatically. Check the current request and earlier decision history with an authorised operator, then acknowledge the inspected state. A current decision alone cannot attribute an earlier uncertain submission. Administrators can open a Guest order refund review alert in Overview, inspect its order, then use the linked Payment records to request the full remaining pre-confirmation refund. A different authorised operator must approve it. A failed or cancelled refund request reopens the alert; a queued refund is not money returned.",
        "In Saved order amounts, compare the saved subtotal, discount, VAT and line total for all ordered units with the requested quantity. This does not prove payment or approve a partial refund. Check earlier refund records. Without a saved breakdown, review the issued invoice rather than applying current prices. An invalid saved breakdown must be resolved before a decision.",
      ],
      "/admin/workforce/aftercare",
      "Scoped financial aftercare adapter, shared OrderAftercareService fee/inspection/audit core and customerAftercareView review-note projection",
      "financial aftercare return cancellation fee approval reject inspection customer-visible decision evidence",
    ),
    version: 5,
    reviewedAt: "2026-11-03",
  },
  {
    ...article(
      "booking-confirmation",
      "booking-confirmation",
      "work",
      "Review an appointment or propose another time",
      "Confirmation requires both current booking scope and a separate owner-granted confirmation permission. A job title or booking-reading responsibility alone is insufficient.",
      [
        "Open Bookings, then a permitted requested appointment. Check the branch, date, assigned staff and service duration.",
        "Record your people and equipment review. Use approved branch capacity, calendar and a resource plan; missing facts never prove availability. The authorised owner uses Workshop resources to select qualified technicians, equipment and shared spaces, assess each service and record working periods, breaks, unavailable periods and physical-unit condition. Review written approval and its effective time; check uncertain results against history instead of resubmitting. A plan does not reserve equipment or grant anyone work permission.",
        "Review the exact appointment and note, then explicitly confirm. The server rechecks scope, the confirmation grant, calendar, daily capacity, staff schedule and version. Confirmation also needs approved resources: service-qualified staff, working periods and distinct equipment/shared-space units for preparation, work and cleanup. It records the allocation atomically; a conflict leaves the request unchanged. Confirmation does not collect money.",
        "When the requested time cannot work, choose Propose another time, check a date and select an available Nigeria time. The search uses the saved job duration and buffers, qualified technicians, current calendar and actual resources. Availability is checked again on proposal, customer acceptance and final approval; a suggestion does not hold capacity. Ordinary requests stay 7-14 days ahead. An observed late visit can use a short-notice alternative. Review the suggested time and reason, then explicitly send the proposal. Sending it does not change the appointment time or confirm the visit.",
        "The customer must review and accept or decline the suggestion. Acceptance creates a pending reschedule request and preserves the original appointment, staff and reminders until approval. Declining keeps the existing appointment. Neither answer charges a fee or uses the customer reschedule allowance.",
        "For a pending reschedule, review the requested time and customer reason. Approval needs current booking scope and independent confirmation authority at both branches. Changing the technician or branch also needs assignment responsibility at both branches. Use only the permitted named technician choices; do not assume a job title grants access.",
        "Record a customer-visible decision reason and, for approval, the people and equipment review. Explicitly confirm the reviewed decision. The server rechecks the original appointment, current technician eligibility, exact offered slot and capacity, then switches the appointment and reminders atomically. Approval carries the previously recorded job and buffer estimate forward; later defaults do not silently replace it. A conflict or decline leaves the original unchanged. A successful customer-originated approval alone uses the reschedule allowance; a workshop-originated approval does not.",
        "Review appointment timing changes only for an assessed, assigned visit whose work has not started. Enter the estimated job time, preparation before arrival, cleanup, an internal reason and the people/equipment review. Blank means unassessed; zero must be explicit. Review and confirm the change. The start and status stay unchanged; saved timing/history are preserved, occupied time is rechecked and a pending reschedule needs fresh review. If the result is uncertain, inspect the current estimate/history before clearing its recovery reference; never resubmit automatically. Authorised service editors can separately change future defaults without rewriting saved booking estimates.",
        "For appointment slots, preparation, job and cleanup must all fit the approved calendar and technician availability. An old or changed service estimate makes an offer unavailable to new customers, even if its stored status still says Open. In Appointment slots, Timing review required offers can be closed or explicitly reviewed and reopened using the current service estimates. An active appointment keeps its saved estimate; use its own authorised timing review instead of rewriting that offer. An offer with any booking history keeps its original schedule, even after cancellation; close the obsolete offer, then publish a new slot for changed service estimates. A slot-bound appointment cannot be reassigned independently of its published technician; use the reviewed reschedule workflow with a matching replacement slot. A service edit after the review is rejected; refresh and review the new values.",
        "For a job with a recorded work start, use Review remaining work and Check current resources. This needs both booking-reading responsibility in the current branch and a separate confirmation grant; a workshop title alone is insufficient. Enter the actual remaining work estimate and an explicit cleanup allowance. Select the real approved physical units, including any additional units genuinely needed, while satisfying the minimum service requirements. Record the internal reason, review the exact selection and explicitly confirm. The server rechecks the full period against the calendar, technician and every selected unit; an existing appointment is never displaced. The original visit, start, service estimate and financial records remain unchanged. Customers see only the estimate and review time. An elapsed estimate does not prove completion. For an uncertain save, inspect the saved review and physical-unit names before clearing its recovery reference; do not send it again automatically.",
        "Cancelling an eligible unstarted visit releases capacity without deleting allocation history. A conflicting reschedule, timing review or reassignment preserves the original booking and resources. Work start rechecks resources; an early or late actual start extends occupied time. Completed work keeps its recorded cleanup period. An elapsed estimate does not prove that ongoing work has ended. Even if an older booking still says Confirmed, a recorded start keeps people and equipment occupied; the responsible operator must record the actual outcome. If older work lacks a resource assessment, request an assessment rather than replacing facts with a note. If the result is uncertain, do not retry automatically. Check the booking and history before acknowledging recovery; current Confirmed status alone does not attribute an earlier uncertain request.",
        "Use Arrival and attendance for observed arrival, agreed waiting or leaving. A customer RSVP is not arrival. After the configured grace, Check attendance requires a factual absence check and reason before marking an unstarted appointment missed. The 15-minute delegated default is not an owner-approved rule. Active work or recorded arrival prevents absence. A missed visit releases eligible capacity; it creates no automatic fee, forfeiture, suspension or refund rejection. Reconcile uncertain saves first. Review actual availability; waiting does not move the appointment or displace another customer. After same-day, same-branch approval, an immutable link retains earlier observed presence, without inventing another arrival. Leaving or a different visit day requires a new observed arrival.",
      ],
      "/admin/workforce/bookings",
      "Scoped confirmation adapter, shared ServiceOperations transition/capacity/schedule/reminders and reviewed booking form",
      "booking appointment confirm calendar capacity equipment people staff schedule resource review requested alternative proposal reschedule suggested time",
    ),
    version: 15,
    reviewedAt: "2026-11-09",
  },
  {
    ...article(
      "booking-reminders",
      "owner",
      "work",
      "Review appointment reminder times",
      "Review branch reminder times through the existing capacity approval. This does not enable booking, email or browser alerts.",
      [
        "Use your verified Super Admin session with MFA. Open Booking capacity and choose the branch. Review the current policy and history first.",
        "Enter up to three distinct whole-minute times before the appointment, from one minute to seven days. Leave blank for none. The delegated implementation defaults are 1,440, 120 and 30 minutes, not a claimed verbatim owner decision.",
        "Record the genuine approval source and evidence. Review the reminder times alongside capacity, calendar and attendance grace, then confirm the new version. A scheduled version applies only from its effective time. An uncertain result requires reconciliation, not a repeated approval.",
        "New confirmations and approved appointment changes use their saved capacity-policy version. Publishing a new policy does not rewrite existing reminder jobs. Changes to an appointment cancel earlier pending reminders and create only future applicable notices; short-notice bookings do not receive a burst of missed reminders.",
        "Reminders do not confirm a request, record arrival, mark absence or cancel a visit. The delivery worker rechecks the confirmed future time and schedule version. Notification preferences and enabled channels still apply; email delivery may be delayed. Browser alerts require separate support, permission and settings. Do not promise SMS or a delivered alert from an unverified provider.",
      ],
      "/admin/booking-capacity",
      "Capacity approval schema, saved appointment policy and versioned reminder workers",
      "booking reminders schedule minutes notification appointment capacity approval",
    ),
    version: 1,
    reviewedAt: "2026-11-09",
  },
  {
    ...article(
      "workshop-resource-plan",
      "owner",
      "work",
      "Review real workshop people and equipment",
      "An active verified Super Admin with MFA records an approved resource plan. A plan does not grant staff permissions or release existing allocations.",
      [
        "Open Workshop resources and choose the actual branch. Inspect the current, next scheduled and latest recorded versions; a newer version is not necessarily the plan currently in effect.",
        "Select existing services and eligible technicians. For each service, record required resource categories and quantities, or explicitly assess that no equipment or shared space is needed. Selecting a name never grants job duties.",
        "Record each actual machine or shared space once, its condition and categories. Enter the real working periods around breaks and dated unavailable periods with a reason. Do not infer two concurrent attended alignment jobs from two machines and one specialist.",
        "Record each technician's actual qualified services and working periods. Remove unavailable selections or resolve their current duties through the separate authorised workforce process.",
        "Enter the written approval source and evidence. Leave the effective time empty to apply on confirmation, or choose a future Nigeria time. Review every physical unit, qualification, period, exception and service requirement before explicitly approving.",
        "A saved version preserves earlier policy and booking allocation history. A stale or rejected approval keeps the draft for review. If the result is uncertain, do not resubmit: check the latest approval record and history, inspect the evidence and acknowledge the reviewed outcome. A newer version alone does not prove that the earlier request succeeded.",
        "Drafts stay in the current tab only. Reloading or leaving loses unsaved plan details; the recovery marker contains no approval body or private staff schedule. Acknowledging recovery does not approve another version or create a booking.",
      ],
      "/admin/booking-resources",
      "Owner resource options/current/publish guards, strict resource receipts and WorkshopResources review/recovery",
      "workshop resources alignment machines equipment shared space qualified technicians breaks unavailable Nigeria approval history recovery",
      "Use an active verified Super Admin session with MFA. Check actual branch, staff, machine condition, shared spaces and working periods; do not invent missing operating facts.",
    ),
    version: 1,
    status: "draft",
    reviewedAt: "2026-11-03",
  },
  {
    ...article(
      "refund-work",
      "refunds",
      "work",
      "Use your separately granted refund duty",
      "Refund approval, transfer and independent checking are separate owner-granted duties. Payment-record reading alone supplies none of them.",
      [
        "Open Refund requests and inspect the current refund. The queue is limited to the stages permitted by your explicit grants; it is not a list of every company refund.",
        "Use only the action enabled for your current grant and the refund's actual status. Re-read the current amount, evidence and recipient before reviewing a change.",
        "An affected-part refund must bind the actual current customer remedy request and its original saved amount, discount and tax. Asking for an alternative is not accepting one. Earlier unbound refunds or unknown historical charges need reconciliation. No handling deduction or fresh price is invented. A financially committed request must be reconciled before another customer choice; failed/cancelled requests retain their history. A requested or approved refund is not money returned. Read actual processing, failed, needs-attention or successful settlement evidence separately.",
        "For an affected-part request, open its actual order and Supply concerns. Only a current administrator can record a concern for checked units and request a refund from a verified captured payment. Review the saved customer choice, affected amount and reason before confirming. Open the resulting refund record to follow independent approval and processing; creating a request does not settle it.",
        "When the customer requested an alternative, the original affected-portion refund can be requested only after their actual current quotation acceptance creates the linked unpaid replacement order. Do not transfer the original payment or force store credit. The original financial and unit resolution must be verified before a replacement payment; its compatibility and availability review remains required.",
        "Read current original, returned and remaining amounts separately. Remaining means retained original payment coverage, including any goods already collected, not a new amount to pay or credit for a replacement. Only the exact independently settled original refund and its canonical debit can clear a recorded affected portion; pending, unknown, disputed or busy proof remains held. Refunded unfulfilled units are separate from goods already collected. The original order is never repriced or transferred to a replacement, and cancelling an unpaid replacement does not erase its historical acceptance or the actual original refund. An administrator may reconcile the remaining goods, while each financial duty keeps its separate grant and independence. Do not treat a refund as a stock return or a physical handover.",
        "Actual settlement is separate from financial closure of the goods obligation. After original refunds are independently verified, an assured administrator may review closure only when actual pickup and refunded unfulfilled positions cover every original unit. It preserves all original receipts, tax and physical history and creates no handover, new charge, credit or consumed-stock return. A refund requester, transfer recorder or checker keeps its separate financial grant; this guide grants none of those duties. Legacy allocation and technical-reversal reconciliation remain distinct review paths.",
        "A checker must be independent of the requester, approver and transfer recorder. A responsibility template or Admin title does not bypass this rule.",
        "After successful original settlement, only the actual administrator can use Reconcile the refunded goods in Supply concerns. Review the original refund record and actual collection history, enter the internal reconciliation note and confirm review. The server requires the exact canonical debit and independent manual checking or provider evidence. Approval, a transfer record or a processing status cannot resolve money. It separates unfulfilled units from previously collected goods, retains immutable history and revokes unused pickup codes. Resolve any active pickup review first. This does not return stock or grant collection; later clearance must recheck current anomalies, disputes and actual remaining goods. For an uncertain save, review the original request and saved history before retrying.",
        "Review and confirm explicitly. If a request's result is uncertain, inspect its saved recovery state before sending anything again. Allie cannot approve or transfer money.",
        "A cancelled original may have an existing whole-order legacy cancellation refund or approved technical reversal without a per-unit allocation. Its actual full return is separate from a new affected-unit refund request. Care may record a cancelled-order payment review after canonical capture and refund evidence is complete; this creates no refund, stock return or handover and grants no financial duty. No captured payment recorded requires no payment attempts, not merely a failed status. Preserve unknown bank outcomes, separate approval and independent checking. New or conflicting money keeps any replacement held.",
      ],
      "/admin/refunds",
      "ManualRefundsService scope/current/check, PaymentsService refund decisions and StaffRefunds review/recovery",
      "refund approve approval transfer independent checker payment evidence uncertain",
    ),
    version: 10,
    reviewedAt: "2026-11-13",
  },
  article(
    "dispute-work",
    "disputes",
    "work",
    "Handle a permitted payment dispute",
    "DISPUTE_MANAGE is an explicit grant. Staff may handle only disputes assigned to them as primary or backup; authorised Admin supervision retains its existing policy.",
    [
      "Open Dispute work queue and select a permitted current record. Inspect its status, response deadline and evidence before acting.",
      "Acknowledgement and evidence actions do not themselves resolve money. Recording a provider submission reference is evidence of an external submission, not provider acceptance.",
      "Only an authorised Admin with this grant may assign the required primary and backup operators. Possessing the handling grant alone does not permit Staff to assign cases.",
      "Review the action and current record before confirming; refresh stale versions and reconcile an uncertain result rather than resending it.",
    ],
    "/admin/payment-disputes/work",
    "DisputesRouter authorized/current/assignment and WorkDisputeHandling review/recovery",
    "dispute chargeback primary backup acknowledge evidence submission assignment",
  ),
  article(
    "privacy-work",
    "privacy",
    "work",
    "Review privacy requests and retention holds",
    "Privacy review requires a separate explicit grant, including for the protected owner. A review does not promise deletion or bypass legal or retention holds.",
    [
      "Open Privacy review and inspect the permitted request's kind, status and current holds.",
      "Check the customer identity, protected records and unresolved disputes. Use only the current reviewed action and record its reason.",
      "Review before confirming. Approval pending policy does not erase data or schedule destructive maintenance; releasing a hold does not delete a record.",
    ],
    "/admin/privacy",
    "PrivacyRouter assertCapability, hold protection and WorkPrivacy review/recovery",
    "privacy deletion export erasure retention hold review personal data",
  ),
  {
    ...article(
      "financial-policy-work",
      "financial-policy",
      "work",
      "Review the financial policy workspace",
      "FINANCE_POLICY_APPROVE is a separate owner-granted duty. Current, latest and scheduled versions may differ; merely holding Accountant responsibility is insufficient.",
      [
        "Open Financial policy and compare its current, latest and next scheduled versions. Use the recorded effective dates and evidence.",
        "Use owner/accountant-verified business details, Tax ID and CAC registration number. If identifiers or their applicability are unresolved, stop before approval; never substitute placeholders. Review the exact change, evidence and expected version before confirming through the authorised form.",
        "A version conflict requires refreshing and reviewing again. Policy publication does not itself collect money or enable unavailable checkout capabilities.",
        "For future orders, the approved arithmetic rounds percentage discounts and VAT once per order to the nearest kobo, with exact halves rounded up. Partial-refund allocations use largest fractional remainders, with ties in saved line order. Preserve issued historical amounts and the saved order breakdown; missing historical allocations need financial review. Recording this decision does not itself publish a policy or activate payments.",
        "New staged service invoices split one accepted quotation into materials and workmanship obligations. The saved VAT and genuine credits are allocated once; do not issue duplicate sales or recalculate tax per payment. PART items are materials; the implementation defers labour and fees until completion. This fee timing is an implementation choice, not a new owner finance approval. Materials payment leaves workmanship outstanding. Work items must match the accepted quotation, quantities and saved prices. The implementation blocks starting work that includes quoted materials until that payment is verified; agreed labour-only work can proceed. This timing is an engineering choice, not a newly recorded owner procurement approval. Additional work needs customer agreement on a reviewed change, not a silently edited issued invoice. An additional-work quotation binds the original invoice reference and a customer-visible reason; include only the new items. Acceptance does not replace the original scope, invoice or payments. Authorised finance staff can prepare and review a separate invoice from that accepted addition, containing only the new items with no reused deposit credit. Issue it only after reviewing the current original agreement and financial holds. Its own materials payment must be verified before those additional materials enter work; original materials payments cannot pay for an additional quantity. Workmanship on each invoice follows completed agreed work. Accepted additions awaiting their reviewed invoice prevent final job completion. A completed visit cannot supply completion evidence for later additional work. New additional scope, customer acceptance and supplemental-invoice review must precede that work; a closed visit needs a new visit or controlled review rather than silent reopening. A quotation alone is not payment, inventory allocation or vehicle-release authority. Historical original invoices without a valid saved stage plan require separate financial review before staged supplements; never fabricate or retrofit a plan. Busy verification or financial exceptions require rechecking before proceeding. Workmanship requires recorded completion and settlement of materials. Unresolved refunds, disputes or payment anomalies require review before another charge. Historical invoices retain their original treatment; do not retrofit an allocation. Invoice identity, tax applicability, permissions and provider acceptance remain separate gates.",
      ],
      "/admin/finance-policy",
      "readFinancePolicy and publishPolicy FINANCE branch, FinancePolicy current/version/review",
      "financial policy finance VAT invoice terms effective scheduled approval version",
    ),
    version: 9,
    reviewedAt: "2026-11-09",
  },
  {
    ...article(
      "parts-fitment",
      "public",
      "parts",
      "Find a part and understand compatibility",
      "Matching a name is not proof that a part fits your vehicle.",
      [
        "Open Parts. Search by product name, brand or part number.",
        "Use the vehicle make, model and year fields where available; check engine, trim and technical requirements. In Filters, edit pending selections, then choose Apply filters. Clear selections only resets the panel; Clear all filters preserves the search and sort. Reset search clears the full discovery state.",
        "Read the compatibility evidence. Compatible, incompatible and not confirmed have different meanings.",
        "Review the current product, vehicle details, quantity, collection information and itemised total before payment. If the offer changes, refresh and review the updated details. If it needs a new check, choose Check details and availability; current approved evidence and stock can still clear it automatically without another staff approval. Recover an uncertain payment request before starting another; a payment request does not take money.",
        "For unknown fitment or missing stock, send an enquiry with the details you actually know. Collection is the launch fulfilment option; do not assume delivery. After verified payment, open your order and choose View invoice. Open its payment details to download or share a verified receipt. Document links require the owning account or private guest email access; forwarding a link does not grant access. Draft invoices and unverified payments have no downloadable customer document. For an existing purchase, open its order and choose cancellation or return options. Cancellation before confirmation is free; later cancellation and returns need staff review. A request or review approval is not a refund payment. If an action is uncertain, use Check original action before another request; only an identical retained retry may be reviewed.",
        "For an unavailable or wrongly supplied original part, choose your preferred review on the actual order. Asking for an alternative does not accept one. Review its actual product, quantity, price, seven-day expiry and terms in the Care case or your private quotations. Explicit acceptance creates a separate unpaid order; it does not transfer your original payment or force store credit. The original affected amount follows independent refund and resolution checks before a new payment. Current compatibility and availability checks still apply. A requested or approved refund is not money returned, and bank posting can take longer. Used, installed, defective or disputed goods require technical assessment; no general returns period or warranty is inferred.",
        "Your selected vehicle and known technical details travel with the cart item. Review them in the cart; changing only quantity retains the vehicle. Adding the product again replaces its vehicle choice. Suitability and stock are checked again when the unpaid order is created. An account is optional for parts purchases. Account customers review quotations in their Customer Care request. If you enquired without an account, open Guest purchases and request private email access; open that link in the browser that requested it. An issued quotation shows its revision, quantity, price, VAT, expiry and terms. It is valid for seven days from issue; the saved expiry time applies. This is not a credit period. Where online transactions are enabled, accepting the current quotation creates an unpaid collection order. Supply the required vehicle and part details. Existing approved suitability information and available branch stock can be checked automatically, allowing payment without another staff approval. Supply the correct vehicle or specification; stock quantity alone does not establish suitability. Missing details, uncertain suitability or unconfirmed supplier availability need staff review before payment. On an unpaid order, open Suitability and availability to enter the vehicle or ask for help. Use details from a previous purchase only after explicitly choosing the same vehicle; copied details are checked against current evidence and stock again. Choose Check details and availability, then review the updated order status. Review the product, quantity, collection arrangements and full amount before continuing to payment. Declined, expired or replaced quotations cannot be accepted. Verified payment is separate from allocation and readiness for collection; a sourced part still needs arrival and item checks.",
      ],
      "/parts",
      "Parts discovery, fitment evidence and approved collection-only launch",
      "shop brake pads compatible compatibility vehicle car guest email purchase quotation seven days",
      "Use the available parts, enquiry and purchase actions. A customer account is optional.",
    ),
    version: 15,
    reviewedAt: "2026-11-03",
  },
  {
    ...article(
      "vehicle-enquiry",
      "public",
      "vehicles",
      "Enquire about a vehicle or inspection",
      "An enquiry or preferred inspection time is not a reservation or confirmed appointment.",
      [
        "Open Vehicles. Edit pending preferences in Filters, then choose Apply filters. Used includes unspecified, foreign and Nigerian use; refine the recorded history when known. Assembly location is separate. Engine / Power type, Fuel type and Drive system are separate filters. Additional features lists supplied equipment, not a certification that it was tested or works; missing features mean information was not supplied. Engine details preserve the supplied description without inferring other specifications. Clear all filters preserves search and sort; Reset search clears the full discovery state.",
        "Open a listing and read the owner-reported condition and known issues beside the enquiry action. These statements are separate from a recorded inspection; missing information does not mean fault-free. Use the requirements enquiry if no listing suits you.",
        "Review the enquiry before sending. In an enquiries release, send a vehicle enquiry to discuss an inspection; there is no online inspection request action. Use an inspection request only when the listing offers it. Neither an enquiry nor a submitted request confirms a visit or reserves the vehicle. The team confirms any inspection separately.",
      ],
      "/vehicles",
      "Vehicle discovery and listing-less enquiry contracts",
      "car sale inspection reservation known issues condition owner reported",
    ),
    version: 6,
    reviewedAt: "2026-11-09",
  },
  {
    ...article(
      "service-request",
      "public",
      "other",
      "Ask about a service or workshop visit",
      "Check the current service options and discuss availability with the team.",
      [
        "Open Services and choose a service. A service group describes a broad area, not an individual priced service; it may have no individual services listed yet. Read the group and choose Ask a question. The selected main service is stored as a structured reference, separately from your editable message. This does not price work or confirm a visit. Allie can explain and link the published group; it cannot confirm a price or appointment from the group alone.",
        "Prepare your vehicle details and concern. Load saved vehicle/contact details when offered. Add a vehicle or edit contacts explicitly; those saves update your account and do not submit the booking. Review the request separately. In your overview, a booked vehicle takes priority, then your garage default or a recently added vehicle. Its saved cover photo remains private. Changing the default does not change a booking or imply work started. Overview can show your recorded first name, open enquiry, issued invoice and order ready for collection, independently of activity-history dates. Open enquiries for replies; Open does not identify who must reply. An invoice total is not a remaining balance: check credits and confirmed payments. Collection readiness uses saved order status. Missing cards create no obligation; summaries do not enable payments.",
        "If your booking form offers a concern request, describe it instead of choosing a service. Vehicle concern means unclassified; no service price or confirmed time is implied. A service group follows your draft through sign-in and review. The saved request keeps the original group name despite later catalogue changes; check Requested service group in booking details.",
        "Use enquiry/contact when booking is unavailable. When booking requests are available, unpaid requests do not depend on checkout being available. An availability check does not submit or confirm your draft. After switching tabs or reconnecting, wait for the current availability check before submitting; the server rechecks writes. Choose a branch and offered time, or preferred Lagos time within the booking window. Offers check qualified people, working periods and equipment/shared space, including preparation and cleanup. A listed time is not reserved. With no offer, send a preferred-time request for staff assessment. Availability is checked again when you submit a request for an offered time; the workshop must still confirm it.",
        "When signing in from the booking review, this tab can keep your anonymous draft for 15 minutes. Review it again after sign-in; it is never sent automatically. Logout or an account change clears it.",
        "Review service, vehicle, requested time and price before submitting. Quotation-required services have no agreed price. No booking deposit is required. Materials are paid first; workmanship becomes payable only after all agreed work is recorded complete. A payment request does not charge you. Work must match your accepted quotation and agreement. Review the original invoice, version, reason and new items before separately accepting or rejecting additional work. Your acceptance does not replace an earlier invoice or make a payment. An addition has a separate invoice for new items only, naming the original and reason; it never reuses deposit credit. Check each invoice's stages and balances. Completed work or a closed visit cannot justify new acceptance; quotations remain readable and rejectable. Ask about a new visit or review. Work using quoted materials waits for verified materials payment, which is not full payment or vehicle release. Collection needs a separate staff record, all agreed balances and collector identity/authority checks. Check uncertain results on the same request. Adjustments need staff review; historical stages may be unknown. Disabled payment capabilities stay unavailable.",
        "Estimated job time is not a promised completion or vehicle-collection time. Saved booking estimates survive changed service defaults; staff can review them with a reason and capacity checks. An unassessed time remains unknown. A remaining-work estimate with its review time stays separate from arrival. Classifying a concern or assigning staff does not confirm the visit, approve a quotation or charge you. Check bookings and quotations separately.",
        "Keep the reference and check bookings for updates. Requests and preferred dates do not reserve capacity or confirm a visit. Staff checks actual people, equipment and shared space. A conflict keeps the request pending; it does not create a payment or replace a confirmed appointment. Check uncertain results on the same request, without creating another.",
        "If your booking offers a workshop-proposed alternative, review the time and reason before responding. Declining keeps your existing appointment. Accepting requests the alternative and still needs workshop confirmation; it does not use your customer reschedule allowance or charge a fee.",
        "In Your bookings, choose View calendar. Switch between Month and Schedule; Today selects the Lagos date. The calendar does not offer or reserve new times; navigation changes only the view. Unscheduled records stay listed. Dates use Nigeria time. A countdown appears only for a confirmed future appointment, then stops. Requests or elapsed countdowns never confirm a visit, start work, change status or prove absence. Refresh after interruptions. Only a confirmed future appointment offers Add to calendar: download a file or open Google Calendar, then review and save. It contains arrival time, location and reference, not private notes or a promised job-end time. Events may not sync automatically: update/remove them after a move or cancellation and check reminders. Export does not confirm a pending request or guarantee an alarm. History records attendance; planning to attend is not arrival. Staff verifies absence, with no automatic fee, suspension, forfeiture or refund rejection. Ask the workshop to confirm a new time.",
        "An optional alert invitation offers Enable notifications, Review notification settings or Not now. No permission is requested by the invitation; only explicitly choosing Enable opens the browser prompt. Delivery needs browser support, permission, availability and a signed-in session; alerts stop on sign-out or expiry. Blocked alerts do not prevent the in-app inbox. Turn off this device in notification settings.",
        "For an eligible confirmed booking, choose Reschedule appointment, select an offered/preferred time and provide a reason. Stale or unavailable offers may be withdrawn; send a preferred-time request for staff assessment instead. An approved move preserves the saved estimate. A request does not reserve its replacement: original appointment and reminders remain unchanged until staff approves the switch. If unavailable at approval, the original stays confirmed. Use Review withdrawal with a reason to withdraw only the pending change; inspect Reschedule history for decisions. After approval, check the confirmed time and update imported calendar events. Cancellation is a separate action under the displayed policy, available only before work starts. After a recorded start contact the workshop, even if an older status still says Confirmed. Short-notice confirmation skips already missed reminders; check the appointment directly. Saved settings apply only to confirmed future appointments. Provider delivery can still be delayed; check your bookings. A reminder does not record arrival, absence or cancellation.",
      ],
      "/services",
      "Public launch mode, ServiceDetail, BookingDetail and ServiceOperationsService booking lifecycle",
      "booking appointment request garage quotation quote",
    ),
    version: 35,
    reviewedAt: "2026-11-09",
  },
  article(
    "security-basics",
    "public",
    "other",
    "Recover access without sharing secrets",
    "Use the existing account recovery path. Help never needs your password, OTP or recovery codes.",
    [
      "Use Forgot password from Sign in if you cannot access your account.",
      "Follow an eligible recovery email privately.",
      "For MFA problems, use only an existing supported recovery method or contact support; do not paste secrets into help or practice.",
    ],
    "/forgot-password",
    "Identity recovery and published account security guidance",
    "login sign in password authenticator mfa",
  ),
  {
    ...article(
      "no-live-lookup",
      "public",
      "other",
      "Does help check my payment or request?",
      "Help explains the website; it does not look up an individual payment, order or booking.",
      [
        "Read the status on your own authorised record.",
        "A pending status or return from a payment page is not proof of verified funds.",
        "Reversal reported means the provider reported a refund or chargeback outcome. The original confirmed amount is historical; it does not prove a refund has reached your bank. Contact customer care and do not pay again until reviewed.",
        "Use the verified support route for a question about your actual record. Online customer transactions are unavailable when the limited launch mode is active.",
      ],
      "/help",
      "Launch restrictions and existing status contracts",
      "money pending paid order confirmed reversal refund chargeback",
    ),
    version: 3,
    reviewedAt: "2026-10-30",
  },
  {
    ...article(
      "own-conversation",
      "customer",
      "customer-care",
      "Follow your own Customer Care request",
      "Keep updates in the same owned conversation and review a reply before sending it.",
      [
        "Open Customer Care and select your enquiry or complaint.",
        "Read the original request, public conversation and current status.",
        "Internal staff notes are not shown in your customer conversation. Only customer-visible messages are available.",
        "Draft relevant new details and review them. Choose Go back to edit your draft or cancel before Send reply; nothing is sent until you explicitly confirm. The guide ends before submission.",
        "For a human from Allie, choose Customer Care · leave a message. Start a new enquiry with a handling branch, or explicitly choose one of your own existing enquiries or complaints. Edit the summary; no help transcript is attached automatically.",
        "Optionally select up to two help message parts, then choose Review message. Check the exact message, branch and destination before Send message to Customer Care. AI-generated excerpts are labelled guidance, not verified case evidence. This handoff works without AI and queues a message; it does not promise live availability or human reading.",
        "If the result is uncertain, use Check handoff or retry the same reviewed message. Go back and edit first checks or cancels the old operation; a message already saved is preserved. Open the verified Customer Care reference to continue. Unsent support and help drafts stay separate.",
        "In an owned case with a handling branch, Request a conversation reviews a channel request in that same case. Queued means saved for Customer Care, not a promised wait time or a representative online. Representative joined is separate from the case's business status.",
        "New conversation updates do not mark notifications as read or move your place in the history. Choose View latest update to change your message position; your unsent reply stays editable. End conversation leaves the case and ordinary follow-up available.",
        "If a conversation action may have saved, use Check saved action before another action. Review stopping action preserves anything already saved and prevents an unsaved delayed action from applying. A missing receipt does not establish failure; follow the displayed recovery guidance instead of submitting another request.",
      ],
      "/dashboard/support",
      "Customer support ownership, drafts and review-before-send",
      "support complaint enquiry reply message",
      "Sign in to your verified customer account; only your own requests are available.",
    ),
    version: 6,
    reviewedAt: "2026-10-28",
  },
  {
    ...article(
      "work-access",
      "work",
      "work",
      "Understand your current work access",
      "Your current responsibilities, branch and assignment determine the work you can see.",
      [
        "Open your dashboard and use its available navigation. Check the scope and actual status on a record before acting.",
        "In a responsibility-managed workspace, an access change can remove an open page and return you to the overview with an explanation. Protected unsent work is discarded, never sent automatically.",
        "If the current access check fails, retry before continuing. Do not repeat an uncertain save without checking its existing recovery guidance.",
        "If a responsibility is missing, ask an authorised access manager. A job title, availability status or practice completion never grants access.",
        "Separately granted refund, dispute, privacy and financial-policy duties use explicit owner grants and their own record and approval rules. They do not widen your branch responsibilities; responsibility removal does not revoke an independent grant.",
      ],
      "/admin",
      "Current workforce scope, registered navigation and access-change recovery",
      "staff role responsibility operations permissions security access removed overview",
    ),
    version: 5,
  },
  {
    ...article(
      "care-triage",
      "care",
      "staff-care",
      "Handle a Customer Care request",
      "Read customer identity, status and conversation before choosing a next step.",
      [
        "Open your permitted enquiry or complaint queue; filter by subject or message.",
        "Open an authorised case and read its existing conversation.",
        "Use the public-reply or internal-note option only where your actual workspace provides it. Managed Customer Service replies are customer-visible.",
        "Review before sending. Dismissing an eligible delivery notice affects only your view; failed delivery and history remain truthful.",
        "Not sent can mean operational email consent is off or another recorded delivery restriction. Check the authorised case delivery history. Do not change consent or ask an administrator to retry a suppressed job to bypass that restriction; a queued retry never proves delivery.",
        "For a linked customer case, check its conversation status. The conversation queue links to the existing case; it does not create another inbox or promise a response time.",
        "Joining requires your current live duty, explicit availability, eligible branch support hours and shared capacity. A disabled live release keeps requests queued; signing in alone never makes you available.",
        "Background updates preserve your message position. Choose View latest update to read a new public message; this does not mark a notification as read. A changed case requires reviewing the retained draft with the latest conversation before sending.",
        "If a conversation action has an uncertain result, check the saved action before trying again. Reviewed cancellation cannot undo a change already saved.",
      ],
      "/admin/workforce/enquiries",
      "Managed care scope, canonical conversation controls, explicit availability and reviewed recovery",
      "customer service officer support complaints follow up",
    ),
    version: 4,
    reviewedAt: "2026-11-13",
  },
  article(
    "sales-enquiries",
    "sales",
    "staff-care",
    "Review assigned sales enquiries",
    "Work only within the branch or assigned records returned by your sales workspace.",
    [
      "Open Enquiries and review the source item and customer question.",
      "Check known product attributes; never turn unknown fitment into a promise.",
      "Use assignment/reply actions only when present for your current permissions. Review a proposed change before confirming.",
    ],
    "/admin/workforce/enquiries",
    "SALES_ENQUIRIES and ENQUIRIES_ASSIGN contracts",
    "cashier sales supervisor sales representative quotation quote",
  ),
  {
    ...article(
      "support-coverage",
      "owner",
      "staff-care",
      "Configure explicit Customer Care support coverage",
      "Approved support hours are separate from workshop hours. Coverage does not release live chat or make representatives available.",
      [
        "Open Customer Care, then Conversation queue and your availability and Branch support coverage (owner). Choose an active branch.",
        "Enter only approved support windows in Africa/Lagos, using 24-hour time. Split overnight coverage into two days; an end may be 24:00. No support hours are supplied automatically.",
        "Review the coverage policy, windows, maximum concurrent conversations per representative and private audit reason before confirming. Current server-side owner and MFA checks still apply.",
        "If coverage changes while you edit, retain your draft and explicitly review the current configuration before adopting its revision. Changing branches keeps unsaved drafts in this page's memory; signing out discards protected work.",
        "For an unconfirmed result, check the saved action instead of repeating the command. Reviewed cancellation blocks an unsaved operation and preserves a change already committed. The browser reminder contains only an operation reference, not hours or the audit reason.",
        "A configured policy never substitutes for current live duties, explicit session-bound availability, branch support hours, shared capacity and separately verified delivery readiness.",
      ],
      "/admin/support",
      "Support live owner/current-session guards, coverage CAS/audit/reference receipts and OwnerSupportCoverage",
      "owner customer care support hours coverage availability midnight timezone audit recovery",
    ),
    version: 1,
    reviewedAt: "2026-10-29",
  },
  {
    ...article(
      "product-timing",
      "admin",
      "work",
      "Record product sourcing and preparation estimates",
      "Estimated sourcing and preparation are separate from stock, payment and collection readiness.",
      [
        "Open Products, then the actual product's Edit details action.",
        "Under Sourcing & preparation estimates, enter the known minimum and maximum calendar days to source the item. Enter preparation minutes once available separately. Leave unknown values blank; use zero only when that is the actual estimate.",
        "Review the estimates before saving. If the product changed, reload its saved details and review your draft again. For an uncertain save, check the saved product before trying again.",
        "These are product defaults, not an order promise. They do not confirm supplier stock, compatibility, payment, an arrival date, a ready-for-collection time or a holding deadline. Confirm those order facts through the authorised workflow.",
      ],
      "/admin",
      "CatalogService product version precondition, product timing validation and ProductTiming projection",
      "product timing sourcing lead time preparation estimate import calendar days minutes",
    ),
    version: 1,
    reviewedAt: "2026-11-09",
  },
  {
    ...article(
      "order-sourcing",
      "admin",
      "work",
      "Update an order's sourcing estimate",
      "Record actual supplier or import progress for this order without changing payment, stock or collection readiness.",
      [
        "Open the actual order. Review its current items and sourcing update before editing.",
        "Under Update this order's sourcing, record each item's actual progress. Enter both ends of a known arrival estimate in Nigeria time, or leave both blank. Preparation minutes begin after arrival; leave unknown preparation blank, and use zero only for no additional preparation.",
        "Write a short customer update and an internal reason. The reason and operator identity are not returned in customer views. Review the order, all item estimates and both notes before saving.",
        "Read the saved update after confirmation. For an uncertain outcome, close the review and refresh before trying again. The saved history is retained; stale or changed order details require a fresh review.",
        "An unavailable item stops fulfilment and retains a linked Customer Care case for the actual affected quantities. A repeated unavailable estimate does not duplicate that case, and a later arrival estimate does not resolve it. Do not silently substitute, take another payment or promise a refund. Sourcing updates cannot mark goods ready, set a holding deadline or authorise collection. Ready and closed orders retain their existing estimates.",
        "Open Supply concerns on the actual order. An administrator can expand Record a supply concern, check the actual items and affected units, and record a customer-facing explanation separately from the private reason. Review before confirming. Staff read access does not grant authoring. The customer or private purchase guest records their own remedy request; never enter a choice on their behalf.",
        "Use the linked Care case Parts quotations to issue an actual alternative against the customer current alternative request. The server binds that request and retains the actual quoted product, price and expiry. Customer acceptance creates a separate unpaid order; staff cannot accept it on the customer behalf. A changed request makes an earlier unaccepted alternative stale. An accepted replacement must be reconciled or cancelled before changing the remedy. New payment remains held pending original financial and affected-unit resolution; no credit or transfer is inferred.",
        "After successful original settlement, only the actual administrator can use Reconcile the refunded goods in Supply concerns. Review the original refund record and actual collection history, enter the internal reconciliation note and confirm review. The server requires the exact canonical debit and independent manual checking or provider evidence. Approval, a transfer record or a processing status cannot resolve money. It separates unfulfilled units from previously collected goods, retains immutable history and revokes unused pickup codes. Resolve any active pickup review first. This does not return stock or grant collection; later clearance must recheck current anomalies, disputes and actual remaining goods. For an uncertain save, review the original request and saved history before retrying.",
        "Once the original affected refund and physical disposition are recorded, fulfil only the actual remaining quantities. Confirmation releases old active holds and reallocates only remaining goods; it does not restock consumed or wrongly supplied items. A source line still marked unavailable cannot proceed unless all its unfulfilled units were actually refunded and removed from collection. Current suitability, receipts, refunds, disputes and anomalies are rechecked; a saved resolution is not permanent clearance. Each collection records actual units and a fresh private code, including a partial handover around refunded units. A fully refunded order with no remaining goods needs separate financial closure, not a zero-quantity handover.",
        "When no goods remain, choose Review financial closure and review original settlement and actual quantities before confirmation. The server requires every affected refund to be independently settled with its canonical debit and every original unit to be actually collected or verified refunded and unfulfilled. It releases only actual active allocations, revokes unused codes and preserves consumed stock and original money. With no actual pickup the original order is cancelled; with an actual earlier pickup the remaining obligation is completed through a separate financial record, never a fake final handover. Outstanding goods, active pickup review, unknown money and technical-reversal cases remain held.",
        "A customer remedy request is separate immutable evidence. Refund review is not financial approval or money returned. Asking for a suitable alternative does not accept a product, price, store credit or another payment. Changed requests retain their history. Used, installed or disputed goods stay in technical assessment; no general returns or warranty terms are approved. The existing supply hold remains until the authorised resolution workflow verifies the outcome.",
        "For an already cancelled original with no recorded handover, Review financial closure can record No captured payment recorded only when there are no payment attempts and all actual intents are closed, or Captured funds returned only after every actual capture has a canonical credit and independently verified full refund debit. This supports already settled whole-order legacy or technical refunds without inventing a per-unit tax allocation. Preserve actual cancellation and all original history. Unknown attempts, anomalies, disputes, claims and technical cases remain held. Separate alternatives still require customer acceptance and current financial clearance; any later capture or conflicting evidence invalidates clearance.",
      ],
      "/admin",
      "OrdersService.updateTiming current-access and OrderTimingUpdate immutable history",
      "order sourcing supplier import arrival preparation estimate unavailable",
    ),
    version: 9,
    reviewedAt: "2026-11-13",
  },
  article(
    "product-photos",
    "admin",
    "work",
    "Manage product photos",
    "Review images, their display order and the main image as separate choices.",
    [
      "Open Products, select the actual product and open Compatibility & images, then Images.",
      "Use the supported image controls and real approved product photos. Review the image description, display order and main-image choice before saving.",
      "Move an image earlier or later only after reviewing the proposed gallery order. Reordering preserves the existing main image; the first image is not automatically main.",
      "Read the saved gallery after a change. If the outcome cannot be confirmed, reload the saved records before trying again. Removing or clearing the main image does not choose a replacement automatically.",
    ],
    "/admin",
    "ProductExtrasEditor, ProductImageForm and administrator-only product-media routes",
    "product image photo gallery upload reorder primary main pictures",
    "Use your current authorised administrator account. This help does not upload or change product images.",
  ),
  article(
    "finance-meaning",
    "finance",
    "work",
    "Interpret payment records without assuming receipt",
    "FINANCE_READ permits reading scoped records; it does not by itself permit confirming funds, refunds or transfers.",
    [
      "Open Payment records in the authorised workforce workspace.",
      "Read the actual status, source evidence and record timestamps.",
      "Treat discrepancies as unresolved until the permitted verification procedure establishes the outcome. Help cannot perform reconciliation.",
    ],
    "/admin/workforce/finance",
    "Workforce finance projection and permission boundary",
    "accountant payment discrepancy pending verified unmatched",
  ),
  {
    ...article(
      "assigned-findings",
      "jobs",
      "work",
      "Record findings on an assigned job",
      "Use only the findings, progress and handover actions available on an authorised job.",
      [
        "Open My jobs or Workshop jobs and choose an accessible job.",
        "Read existing work, assignment and current version before drafting findings.",
        "Describe observations and the next handover clearly; do not invent a diagnosis.",
        "Review any update. Quality approval and assignment are separate permissions. For a staged invoice, work items must match the accepted quotation and saved prices. Agreed labour-only work can begin separately; work using quoted materials waits for verified materials payment. Additional work needs customer agreement. Complete all agreed work before requesting completion, and recheck a busy or financially held payment. This does not grant payment-record access or vehicle-release authority.",
        "Where your existing assigned-job responsibility allows it, use Arrival and attendance to record observed arrival, agreed waiting or leaving with a factual note. A customer RSVP is not arrival. Check absence only after the server offers Check attendance and after checking that the customer has not arrived. Active work or a prior recorded arrival prevents marking the appointment missed. No automatic fee or suspension follows. This does not grant booking-confirmation or assignment authority. Reconcile an uncertain save before sending another update.",
      ],
      "/admin/workforce/jobs",
      "JOBS_READ/JOBS_UPDATE, assigned scope and work review",
      "electrical diagnostics mechanic technician handover",
    ),
    version: 6,
    reviewedAt: "2026-11-09",
  },
  {
    ...article(
      "job-assignment",
      "assign",
      "work",
      "Review a workshop assignment and quality boundary",
      "Assignment and quality approval are separate controlled actions.",
      [
        "Open the scoped Workshop jobs queue and inspect the job.",
        "Use the actual eligible-assignee list; a tutorial cannot assign a real technician.",
        "For a concern-only request, choose a published service with a configured duration before assigning the technician. The original concern is retained and the booking remains requested; classification does not confirm the appointment, approve a quotation or collect payment.",
        "Review the intended assignment and current version. Use quality approval only with QUALITY_APPROVE and the required evidence. For staged invoices, check that the work items match the accepted quotation. Quoted materials need verified payment before their work starts; agreed labour can proceed separately. Completion requires all agreed work, not just a subset. Additional work needs customer agreement and a reviewed change; never silently alter an issued invoice.",
      ],
      "/admin/workforce/jobs",
      "JOBS_ASSIGN and QUALITY_APPROVE routes",
      "workshop lead quality service",
    ),
    version: 3,
    reviewedAt: "2026-11-09",
  },
  article(
    "mixed-queues",
    "operations",
    "work",
    "Coordinate the queues you are assigned",
    "Combined responsibilities are the union of current assignments, not a hard-coded Operations exception.",
    [
      "Review the available booking/order queues in your navigation.",
      "Read each record's branch, status and next available action.",
      "Route a care or sales issue only through responsibilities you actually hold. Missing coverage needs an authorised assignment.",
    ],
    "/admin",
    "OPERATIONS template and effective assignment union",
    "operations supervisor interim coordination",
  ),
  article(
    "oversight-scope",
    "oversight",
    "work",
    "Understand the scope of an oversight view",
    "A CEO/MD title does not automatically make a scoped count a whole-company total.",
    [
      "Open the available overview.",
      "Read the definition, freshness and current scope of each available measure.",
      "Do not infer an organisation-wide financial or completion result from a partial view.",
    ],
    "/admin",
    "CEO_MD position and permission-filtered overview",
    "ceo md metrics reports oversight",
  ),
  article(
    "customer-account-review",
    "admin",
    "work",
    "Review a customer account restriction",
    "Suspension/reactivation requires an authorised administrator, a reason and deliberate review; it is not a Customer Service power.",
    [
      "Open Customers and the intended customer detail.",
      "Check the current role and account status; staff/admin accounts cannot be restricted through this customer action.",
      "Review the reason and effects. Suspension revokes sessions; reactivation never restores old sessions.",
      "Stop before confirmation if you are only learning. Practice never restricts a real account.",
    ],
    "/admin/customers",
    "Customer account lock, session enforcement and audit contract",
    "suspend reactivate admin customer directory",
  ),
  {
    ...article(
      "access-review",
      "access",
      "work",
      "Review invitations and responsibility access safely",
      "Existing MFA, password, branch and delegation controls still apply.",
      [
        "Open People in Team & Access and select View person. Check the selected person's identity, account level, job position, branch and status. A job title does not grant duties.",
        "During a long edit, check Selected person above the form. Use Overview to return to their account details. If current identity is unavailable, refresh before relying on earlier details.",
        "Enter start and end dates in Lagos time, regardless of this device's time zone. New temporary cover needs an end date. The selected person stays above the scrolling review details. Existing open-ended cover is kept for review; it is not silently changed or removed.",
        "Read What this person can access, then expand Allowed actions and why they are available. This is a partial summary: account-level permissions are not itemized, and separately approved duties appear only when your access permits that check. An unavailable check does not mean no access.",
        "Before assigning or revoking a responsibility, review access added, removed and retained. Revoking one grant can leave the same access supplied by another active grant. Scheduled assignments supply no access before their start.",
        "Check the reason and current delegation. If access changes before confirmation, refresh and review again; if a save is uncertain, inspect and reconcile it before retrying.",
        "Do not delegate a capability or scope outside your current permitted delegation. Having permission to act does not by itself give permission to delegate, and a job title does not expand your authority.",
        "In Invitations & staff access, choose Give a customer staff access or Invite staff to administrator access before searching an exact email. Review the selected person and current versus proposed account level. Customer-to-staff confirmation changes access immediately and revokes sessions; an administrator invitation changes access only after eligible acceptance and a new sign-in.",
        "Cancel unused invitation disables only the unused link; it does not remove existing account access. Accepted is a historical status, not proof of the person's current access. Pending email may be queued without being delivered. If the result is uncertain, reconcile the previous change before starting another task.",
        "Do not share invitations or enter a password into help. Reading help or completing practice never grants privileges.",
      ],
      "/admin/workforce/access",
      "Team access security, pinned delegation and reviewed responsibility impact",
      "invite staff admin operations permissions access added removed retained grant sources delegate delegation authority privileges",
    ),
    version: 8,
    reviewedAt: "2026-11-13",
  },
  article(
    "privileged-recovery",
    "owner",
    "work",
    "Use the approved account recovery process",
    "Help is not a bootstrap console or a place to enter privileged secrets.",
    [
      "Identify the verified operational procedure and responsible owner.",
      "Preserve recovery evidence and use the existing controlled process outside this learning surface.",
      "Never paste credentials, execute arbitrary commands or change live access through practice.",
    ],
    "/admin/security",
    "Existing identity/governance safeguards",
    "super admin recovery configuration",
  ),
];
export interface LearningGuide {
  id: string;
  version: number;
  title: string;
  articleId: string;
  page: LearningPage;
  href: string;
  gate: LearningGate;
  steps: {
    id: string;
    target: LearningTarget;
    text: string;
    event: "input" | "click" | "read";
  }[];
}
export const learningGuides: LearningGuide[] = [
  {
    id: "parts-find",
    version: 3,
    title: "Find the right part",
    articleId: "parts-fitment",
    page: "parts",
    href: "/parts",
    gate: "public",
    steps: [
      {
        id: "search",
        target: "parts-search",
        text: "Enter a part name such as oil filter, a brand or a part number, then use Search. A name match alone does not confirm compatibility.",
        event: "input",
      },
      {
        id: "evidence",
        target: "parts-results",
        text: "Read the available results and compatibility evidence. Filters remain pending until Apply filters. Clear selections resets pending values; Clear all filters preserves search and sort. Unknown compatibility needs an enquiry; this guide never adds a live item to a cart.",
        event: "read",
      },
    ],
  },
  {
    id: "own-request",
    version: 1,
    title: "Prepare your own support request",
    articleId: "own-conversation",
    page: "customer-care",
    href: "/dashboard/support",
    gate: "customer",
    steps: [
      {
        id: "open",
        target: "support-start",
        text: "Open New enquiry yourself. Opening and closing this help does not replace an existing draft.",
        event: "click",
      },
      {
        id: "subject",
        target: "support-subject",
        text: "Write a short subject using your actual facts. No example is inserted into this live form.",
        event: "input",
      },
      {
        id: "review",
        target: "support-subject",
        text: "Complete the remaining required fields and review only when ready. This walkthrough ends before sending. Use practice for fictional examples.",
        event: "read",
      },
    ],
  },
  {
    id: "care-queue",
    version: 1,
    title: "Read your Customer Care queue",
    articleId: "care-triage",
    page: "staff-care",
    href: "/admin/workforce/enquiries",
    gate: "care",
    steps: [
      {
        id: "filter",
        target: "care-search",
        text: "Enter a subject or original-message search. Your existing branch and responsibility scope still apply.",
        event: "input",
      },
      {
        id: "inspect",
        target: "care-results",
        text: "Read the scoped results or the truthful empty state. Open a case yourself if needed. No reply, assignment or delivery action is performed by this guide.",
        event: "read",
      },
    ],
  },
];
export interface PracticeField {
  id: string;
  label: string;
  example: string;
  min: number;
  max: number;
  options?: string[];
  dependsOn?: string;
}
export interface PracticeDefinition {
  id: string;
  version: number;
  title: string;
  gate: LearningGate;
  articleId: string;
  kind: "fitment" | "draft" | "decision";
  objective: string;
  fields: PracticeField[];
  choices: { id: string; label: string; feedback: string }[];
  expected: string;
  outcome: string;
  liveHref: string;
}
const decision = (
  id: string,
  gate: LearningGate,
  title: string,
  articleId: string,
  objective: string,
  correct: string,
  unsafe: string,
  liveHref: string,
): PracticeDefinition => ({
  id,
  version: 2,
  gate,
  title,
  articleId,
  kind: "decision",
  objective,
  fields: [],
  expected: "review",
  choices: [
    {
      id: "review",
      label: correct,
      feedback: `You chose to ${correct.charAt(0).toLowerCase() + correct.slice(1)}. ${objective} This keeps the missing evidence and your responsibility clear.`,
    },
    {
      id: "assume",
      label: unsafe,
      feedback: `You chose to ${unsafe.charAt(0).toLowerCase() + unsafe.slice(1)}. ${objective} The sample does not establish that outcome or permission. Try again and check what is missing.`,
    },
  ],
  outcome:
    "Practice decision reviewed. No real record, permission, payment or message changed.",
  liveHref,
});
export const practiceDefinitions: PracticeDefinition[] = [
  {
    id: "corolla-fitment",
    version: 1,
    gate: "public",
    title: "Find fictional Corolla brake pads",
    articleId: "parts-fitment",
    kind: "fitment",
    objective:
      "Compare compatible, incompatible and unknown sample evidence for a fictional Toyota Corolla 2018. These results do not certify a real part.",
    fields: [
      {
        id: "make",
        label: "Vehicle make",
        example: "Toyota",
        min: 1,
        max: 30,
        options: ["Toyota"],
      },
      {
        id: "model",
        label: "Vehicle model",
        example: "Corolla",
        min: 1,
        max: 30,
        options: ["Corolla"],
        dependsOn: "make",
      },
      {
        id: "year",
        label: "Vehicle year",
        example: "2018",
        min: 4,
        max: 4,
        options: ["2018"],
        dependsOn: "model",
      },
      { id: "query", label: "Part search", example: "Brake pads", min: 2, max: 100 },
    ],
    choices: [
      {
        id: "ask",
        label: "Ask for details when fitment is unknown",
        feedback:
          "Correct: unknown is not compatible. Check the missing technical evidence before a real purchase.",
      },
      {
        id: "buy",
        label: "Treat every matching name as a verified fit",
        feedback:
          "A matching name is not evidence of compatibility. Compare the three fictional outcomes.",
      },
    ],
    expected: "ask",
    outcome:
      "Fictional search and evidence review complete. No stock, cart, order or payment changed.",
    liveHref: "/parts",
  },
  {
    id: "enquiry-draft",
    version: 1,
    gate: "customer",
    title: "Prepare a fictional customer enquiry",
    articleId: "own-conversation",
    kind: "draft",
    objective:
      "Practise a clear subject and message, then review them without sending anything.",
    fields: [
      {
        id: "subject",
        label: "Fictional subject",
        example: "Practice Customer 001: brake inspection question",
        min: 5,
        max: 160,
      },
      {
        id: "message",
        label: "Fictional message",
        example:
          "Practice Customer 001 asks about brake inspection for a fictional Toyota Corolla 2018. Please explain what details are needed. No appointment is confirmed.",
        min: 10,
        max: 600,
      },
    ],
    choices: [
      {
        id: "review",
        label: "Review this fictional draft only",
        feedback: "The sample is a draft, not a sent request or confirmed appointment.",
      },
      {
        id: "sent",
        label: "Claim a live request or appointment is confirmed",
        feedback:
          "Practice cannot send a live request or reserve capacity. Review the draft only.",
      },
    ],
    expected: "review",
    outcome: "Fictional draft reviewed. No enquiry sent and no appointment booked.",
    liveHref: "/dashboard/support",
  },
  {
    ...decision(
      "care-triage",
      "care",
      "Reply to a sample Customer Care request",
      "care-triage",
      "Sample conversation — Practice Customer 001: “Will this oil filter fit my car?” No model, year, engine or part number is supplied. Draft a helpful public reply asking for those details; do not promise compatibility.",
      "Ask for the missing details through a permitted reply",
      "Promise fitment or a refund without evidence",
      "/admin/workforce/enquiries",
    ),
    kind: "draft",
    fields: [
      {
        id: "reply",
        label: "Sample public reply",
        min: 20,
        max: 600,
        example:
          "Thanks for checking. Please share your vehicle make, model, year, engine details and the filter part number if available. We need to review the compatibility evidence before confirming a fit.",
      },
    ],
    choices: [
      {
        id: "review",
        label: "Ask for the missing details through a permitted reply",
        feedback:
          "Model, year, engine and filter part number are missing. Ask for those details before checking compatibility; a name match does not confirm a fit.",
      },
      {
        id: "assume",
        label: "Promise fitment or a refund without evidence",
        feedback:
          "The sample provides no compatibility evidence or approved refund basis. Promising either would claim facts that are not established. Ask for the missing vehicle and part details first.",
      },
    ],
    outcome:
      "Keep your sample reply clear and free of fitment promises. No real message was sent.",
  },
  decision(
    "sales-evidence",
    "sales",
    "Review fictional product information",
    "sales-enquiries",
    "A fictional sales enquiry contains a matching product name but no verified fitment evidence.",
    "Check the missing technical details before making a claim",
    "Treat the name match as confirmed compatibility",
    "/admin/workforce/enquiries",
  ),
  decision(
    "payment-discrepancy",
    "finance",
    "Interpret a fictional payment discrepancy",
    "finance-meaning",
    "A fictional payment record is pending. An external screenshot is not independently verified receipt.",
    "Keep the outcome unresolved and follow the permitted verification process",
    "Mark funds received or issue a refund from this sample",
    "/admin/workforce/finance",
  ),
  {
    id: "job-handover",
    version: 1,
    gate: "jobs",
    title: "Write fictional findings and handover",
    articleId: "assigned-findings",
    kind: "draft",
    objective:
      "Use a fictional assigned job. Record observations, uncertainty and the next handover without diagnosing a real vehicle.",
    fields: [
      {
        id: "findings",
        label: "Fictional findings",
        example:
          "Practice vehicle: an intermittent noise is reported. Cause is not yet verified; further inspection is needed.",
        min: 10,
        max: 600,
      },
      {
        id: "handover",
        label: "Fictional handover",
        example:
          "Practice handover: next authorised technician should review the observations and record the inspection outcome.",
        min: 10,
        max: 600,
      },
    ],
    choices: [
      {
        id: "review",
        label: "Review the fictional note within assigned work",
        feedback: "Clear observations and uncertainty support the next permitted step.",
      },
      {
        id: "approve",
        label: "Approve quality or reassign a real job from practice",
        feedback: "Those are separate controlled actions. Practice cannot perform them.",
      },
    ],
    expected: "review",
    outcome:
      "Fictional findings reviewed. No real job, stock request or notification changed.",
    liveHref: "/admin/workforce/jobs",
  },
  decision(
    "assignment-review",
    "assign",
    "Review a fictional workshop assignment",
    "job-assignment",
    "A fictional job offers an eligible practice technician and an unrelated person outside the sample scope.",
    "Choose the eligible sample assignment and review its scope",
    "Choose someone outside the permitted scope",
    "/admin/workforce/jobs",
  ),
  decision(
    "mixed-queue",
    "operations",
    "Interpret a fictional mixed queue",
    "mixed-queues",
    "A fictional order needs preparation and an unrelated financial issue appears. The sample does not grant a finance permission.",
    "Handle only the assigned queue and route the other issue appropriately",
    "Assume Operations can perform every financial action",
    "/admin",
  ),
  decision(
    "oversight-review",
    "oversight",
    "Interpret a fictional oversight measure",
    "oversight-scope",
    "A sample count covers one permitted queue and a fictional date range; it is not a company-wide financial total.",
    "Read its scope and freshness before drawing a conclusion",
    "Present the count as a verified company-wide result",
    "/admin",
  ),
  decision(
    "access-review",
    "access",
    "Review a fictional access proposal",
    "access-review",
    "A sample invitation proposes access beyond the operator's approved delegation. No actual invitation exists.",
    "Stop and obtain the required authorised review",
    "Grant extra access because a title or tutorial requests it",
    "/admin/workforce/access",
  ),
  decision(
    "owner-recovery",
    "owner",
    "Choose the safe privileged recovery path",
    "privileged-recovery",
    "Someone asks you to paste a recovery credential into practice or execute an arbitrary command.",
    "Keep the secret private and use the verified recovery procedure",
    "Paste the credential or run the supplied command",
    "/admin/security",
  ),
];
