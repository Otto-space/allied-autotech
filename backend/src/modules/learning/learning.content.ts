// Backend-owned corpus. Never import this module into frontend code.
export type LearningGate =
  | "public"
  | "customer"
  | "work"
  | "care"
  | "sales"
  | "finance"
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
    "If the required control is unavailable, refresh your access or use Contact support. Do not bypass a restriction or repeat an uncertain submission.",
  version: 2,
  status: "published",
  reviewedAt: "2026-10-26",
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
    "parts-fitment",
    "public",
    "parts",
    "Find a part and understand compatibility",
    "Matching a name is not proof that a part fits your vehicle.",
    [
      "Open Parts. Search by product name, brand or part number.",
      "Use the vehicle make, model and year fields where available; check any engine, trim or technical requirements.",
      "Read the compatibility evidence. Compatible, incompatible and not confirmed have different meanings.",
      "For unknown fitment or missing stock, send an enquiry with the details you actually know. Collection is the launch fulfilment option; do not assume delivery.",
    ],
    "/parts",
    "Parts discovery, fitment evidence and approved collection-only launch",
    "shop brake pads compatible compatibility vehicle car",
  ),
  article(
    "vehicle-enquiry",
    "public",
    "vehicles",
    "Enquire about a vehicle or inspection",
    "An enquiry or preferred inspection time is not a reservation or confirmed appointment.",
    [
      "Open Vehicles and use the available filters.",
      "Open a listing to review its actual condition and details, or use the supported requirements enquiry if no listing suits you.",
      "Review the enquiry before sending. The team confirms any inspection separately.",
    ],
    "/vehicles",
    "Vehicle discovery and listing-less enquiry contracts",
    "car sale inspection reservation",
  ),
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
  article(
    "own-conversation",
    "customer",
    "customer-care",
    "Follow your own Customer Care request",
    "Keep updates in the same owned conversation and review a reply before sending it.",
    [
      "Open Customer Care and select your enquiry or complaint.",
      "Read the original request, public conversation and current status.",
      "Draft relevant new details, review them and confirm only when you intend to send. The guide ends before submission.",
    ],
    "/dashboard/support",
    "Customer support ownership, drafts and review-before-send",
    "support complaint enquiry reply message",
    "Sign in to your verified customer account; only your own requests are available.",
  ),
  article(
    "work-access",
    "work",
    "work",
    "Understand your current work access",
    "Your current responsibilities, branch and assignment determine the work you can see.",
    [
      "Open your dashboard and use its available navigation.",
      "Check the scope and actual status on a record before acting.",
      "If a responsibility is missing, ask an authorised access manager. A job title or practice completion never grants access.",
    ],
    "/admin",
    "Workforce snapshot, scope policy and dashboard navigation",
    "staff role responsibility operations permissions security",
  ),
  article(
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
    ],
    "/admin/workforce/enquiries",
    "Managed care scope, public/internal separation and delivery acknowledgements",
    "customer service officer support complaints follow up",
  ),
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
  article(
    "access-review",
    "access",
    "work",
    "Review invitations and responsibility access safely",
    "Existing MFA, password, branch and delegation controls still apply.",
    [
      "Open the appropriate Team & Access workspace.",
      "Check the intended recipient, role, responsibility, branch and current delegation.",
      "Review the proposal and reason. Do not share an invitation or use help to acquire additional privileges.",
    ],
    "/admin/workforce/access",
    "Team access security and delegation policy",
    "invite staff admin operations permissions",
  ),
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
    version: 2,
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
        text: "Read the available results and compatibility evidence. Missing results or unknown fitment need an enquiry; the guide never adds a live item to a cart.",
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
