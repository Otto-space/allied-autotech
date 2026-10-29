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
      "home-next-step",
      "public",
      "home",
      "Choose your next step with Allied AutoTech",
      "Start with Services for vehicle care, Shop for products and compatibility, or Vehicles for listings and requirements enquiries. The team confirms availability and arrangements separately.",
      [
        "Choose Services to describe the work or symptoms you need help with.",
        "Choose Shop to review products, listed branch availability and compatibility. Missing availability or fitment information needs confirmation from the team.",
        "Choose Vehicles to inspect published listings or explain your requirements when no listing suits you. An enquiry is not a reservation.",
        "Use Help & Learn for instructions or Contact to speak to the team. The website guide does not inspect or change your records.",
      ],
      "/services",
      "Home customer routes, catalogue availability contract and approved enquiries launch",
      "home homepage start services shop products vehicles enquiry",
    ),
    version: 1,
    reviewedAt: "2026-10-27",
  },
  article(
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
      "For a lost or unverified response, do not retry automatically. Check the current request and earlier decision history with an authorised operator, then acknowledge the inspected state. A current decision alone cannot attribute an earlier uncertain submission.",
    ],
    "/admin/workforce/aftercare",
    "Scoped financial aftercare adapter, shared OrderAftercareService fee/inspection/audit core and customerAftercareView review-note projection",
    "financial aftercare return cancellation fee approval reject inspection customer-visible decision evidence",
  ),
  article(
    "booking-confirmation",
    "booking-confirmation",
    "work",
    "Review a scoped appointment confirmation",
    "Confirmation requires both current booking scope and a separate owner-granted confirmation permission. A job title or booking-reading responsibility alone is insufficient.",
    [
      "Open Bookings, then a permitted requested appointment. Check the branch, date, assigned staff and service duration.",
      "Record your people and equipment review. An authorised policy owner must configure approved branch capacity and the opening calendar; missing configuration is not permission to invent capacity or confirm availability.",
      "Review the exact appointment and note, then explicitly confirm. The server rechecks scope, the confirmation grant, calendar, daily capacity, staff schedule and version. Confirmation does not collect money.",
      "If the result is uncertain, do not retry automatically. Check the current booking and its history, then acknowledge what you inspected. A current confirmed status alone does not attribute an earlier uncertain request.",
    ],
    "/admin/workforce/bookings",
    "Scoped confirmation adapter, shared ServiceOperations transition/capacity/schedule/reminders and reviewed booking form",
    "booking appointment confirm calendar capacity equipment people staff schedule resource review requested",
  ),
  article(
    "refund-work",
    "refunds",
    "work",
    "Use your separately granted refund duty",
    "Refund approval, transfer and independent checking are separate owner-granted duties. Payment-record reading alone supplies none of them.",
    [
      "Open Refund requests and inspect the current refund. The queue is limited to the stages permitted by your explicit grants; it is not a list of every company refund.",
      "Use only the action enabled for your current grant and the refund's actual status. Re-read the current amount, evidence and recipient before reviewing a change.",
      "A checker must be independent of the requester, approver and transfer recorder. A responsibility template or Admin title does not bypass this rule.",
      "Review and confirm explicitly. If a request's result is uncertain, inspect its saved recovery state before sending anything again. Allie cannot approve or transfer money.",
    ],
    "/admin/refunds",
    "ManualRefundsService scope/current/check, PaymentsService refund decisions and StaffRefunds review/recovery",
    "refund approve approval transfer independent checker payment evidence uncertain",
  ),
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
  article(
    "financial-policy-work",
    "financial-policy",
    "work",
    "Review the financial policy workspace",
    "FINANCE_POLICY_APPROVE is a separate owner-granted duty. Current, latest and scheduled versions may differ; merely holding Accountant responsibility is insufficient.",
    [
      "Open Financial policy and compare its current, latest and next scheduled versions. Use the recorded effective dates and evidence.",
      "Use approved business details and evidence, review the exact change and expected version, then confirm only through the authorised form.",
      "A version conflict requires refreshing and reviewing again. Policy publication does not itself collect money or enable unavailable checkout capabilities.",
    ],
    "/admin/finance-policy",
    "readFinancePolicy and publishPolicy FINANCE branch, FinancePolicy current/version/review",
    "financial policy finance VAT invoice terms effective scheduled approval version",
  ),
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
        "For unknown fitment or missing stock, send an enquiry with the details you actually know. Collection is the launch fulfilment option; do not assume delivery.",
      ],
      "/parts",
      "Parts discovery, fitment evidence and approved collection-only launch",
      "shop brake pads compatible compatibility vehicle car",
    ),
    version: 3,
    reviewedAt: "2026-10-29",
  },
  {
    ...article(
      "vehicle-enquiry",
      "public",
      "vehicles",
      "Enquire about a vehicle or inspection",
      "An enquiry or preferred inspection time is not a reservation or confirmed appointment.",
      [
        "Open Vehicles. Edit pending preferences in Filters, then choose Apply filters. Used includes unspecified, foreign and Nigerian use; refine the recorded history when known. Assembly location is separate. Clear all filters preserves search and sort; Reset search clears the full discovery state.",
        "Open a listing and read the owner-reported condition and known issues beside the enquiry action. These statements are separate from a recorded inspection; missing information does not mean fault-free. Use the requirements enquiry if no listing suits you.",
        "Review the enquiry before sending. The team confirms any inspection separately.",
      ],
      "/vehicles",
      "Vehicle discovery and listing-less enquiry contracts",
      "car sale inspection reservation known issues condition owner reported",
    ),
    version: 4,
    reviewedAt: "2026-10-29",
  },
  article(
    "service-request",
    "public",
    "other",
    "Ask about a service or workshop visit",
    "Check the current service options and discuss availability with the team.",
    [
      "Open Services and choose the relevant service.",
      "Prepare the vehicle details and the issue you have noticed.",
      "Use the enquiry/contact path. A preferred date does not reserve workshop capacity.",
    ],
    "/services",
    "Public launch mode and Services page",
    "booking appointment request garage quotation quote",
  ),
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
  article(
    "no-live-lookup",
    "public",
    "other",
    "Does help check my payment or request?",
    "Help explains the website; it does not look up an individual payment, order or booking.",
    [
      "Read the status on your own authorised record.",
      "A pending status or return from a payment page is not proof of verified funds.",
      "Use the verified support route for a question about your actual record. Online customer transactions are unavailable when the limited launch mode is active.",
    ],
    "/help",
    "Launch restrictions and existing status contracts",
    "money pending paid order confirmed",
  ),
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
        "For a linked customer case, check its conversation status. The conversation queue links to the existing case; it does not create another inbox or promise a response time.",
        "Joining requires your current live duty, explicit availability, eligible branch support hours and shared capacity. A disabled live release keeps requests queued; signing in alone never makes you available.",
        "Background updates preserve your message position. Choose View latest update to read a new public message; this does not mark a notification as read. A changed case requires reviewing the retained draft with the latest conversation before sending.",
        "If a conversation action has an uncertain result, check the saved action before trying again. Reviewed cancellation cannot undo a change already saved.",
      ],
      "/admin/workforce/enquiries",
      "Managed care scope, canonical conversation controls, explicit availability and reviewed recovery",
      "customer service officer support complaints follow up",
    ),
    version: 3,
    reviewedAt: "2026-10-29",
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
  article(
    "assigned-findings",
    "jobs",
    "work",
    "Record findings on an assigned job",
    "Use only the findings, progress and handover actions available on an authorised job.",
    [
      "Open My jobs or Workshop jobs and choose an accessible job.",
      "Read existing work, assignment and current version before drafting findings.",
      "Describe observations and the next handover clearly; do not invent a diagnosis.",
      "Review any update. Quality approval and assignment are separate permissions.",
    ],
    "/admin/workforce/jobs",
    "JOBS_READ/JOBS_UPDATE, assigned scope and work review",
    "electrical diagnostics mechanic technician handover",
  ),
  article(
    "job-assignment",
    "assign",
    "work",
    "Review a workshop assignment and quality boundary",
    "Assignment and quality approval are separate controlled actions.",
    [
      "Open the scoped Workshop jobs queue and inspect the job.",
      "Use the actual eligible-assignee list; a tutorial cannot assign a real technician.",
      "Review the intended assignment and current version. Use quality approval only with QUALITY_APPROVE and the required evidence.",
    ],
    "/admin/workforce/jobs",
    "JOBS_ASSIGN and QUALITY_APPROVE routes",
    "workshop lead quality service",
  ),
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
        "Open the appropriate Team & Access workspace and inspect the intended person. Account role, job position and responsibility assignments are separate.",
        "Expand Effective responsibility access to check capabilities, branches and grant sources within your permitted view. Account baseline and separately granted permissions keep their existing rules.",
        "Before assigning or revoking a responsibility, review access added, removed and retained. Revoking one grant can leave the same access supplied by another active grant. Scheduled assignments supply no access before their start.",
        "Check the reason and current delegation. If access changes before confirmation, refresh and review again; if a save is uncertain, inspect and reconcile it before retrying.",
        "Do not delegate a capability or scope outside your current permitted delegation. Having permission to act does not by itself give permission to delegate, and a job title does not expand your authority.",
        "Do not share invitations or enter a password into help. Reading help or completing practice never grants privileges.",
      ],
      "/admin/workforce/access",
      "Team access security, pinned delegation and reviewed responsibility impact",
      "invite staff admin operations permissions access added removed retained grant sources delegate delegation authority privileges",
    ),
    version: 4,
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
