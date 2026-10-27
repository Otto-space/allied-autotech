import { browseEnquiriesOnly } from "./public-launch";
export const business = {
  name: "Allied AutoTech",
  legalName: "Allied Autotech Limited",
  address:
    "133 Stadium Road, beside Kilimanjaro Pizza Jungle Restaurant, Port Harcourt, Rivers State, Nigeria",
  phone: "08136075567",
  internationalPhone: "+2348136075567",
  whatsapp: "https://wa.me/2348136075567",
  email: "support@alliedautotech.com",
  customerCareHours: "Monday–Saturday, 8am–6pm (Nigeria time)",
  customerCareResponse:
    "We aim to acknowledge enquiries within 30 minutes during these hours. Messages received outside these hours are acknowledged within 30 minutes of our next opening. Resolution time depends on the enquiry.",
  socialHandle: "@AlliedAutoTech",
  directions:
    "https://www.google.com/maps/dir/?api=1&destination=" +
    encodeURIComponent(
      "133 Stadium Road, beside Kilimanjaro Pizza Jungle Restaurant, Port Harcourt, Rivers State, Nigeria",
    ),
} as const;

export const faqs = [
  {
    id: "booking-a-service",
    category: "Bookings and services",
    question: "How do I book a service?",
    answer: browseEnquiriesOnly()
      ? "Open Services, choose a service and send an enquiry, or contact us by phone or WhatsApp. Our team will discuss availability and confirm any appointment separately."
      : "Open Services, choose a service and review its available appointments. Sign in to send a booking request. The workshop confirms availability before the appointment is confirmed. Current terms are shown before you submit.",
    keywords: "book appointment service slot time",
    href: "/services",
    action: "Explore services",
  },
  {
    id: "visit-the-workshop",
    category: "Contact and location",
    question: "Where is Allied AutoTech?",
    answer: business.address + ". Contact us if you need help finding the workshop.",
    keywords: "location address map directions workshop visit",
    href: business.directions,
    action: "Get directions",
  },
  {
    id: "contact-customer-care",
    category: "Contact and location",
    question: "How can I speak to someone?",
    answer:
      "Call our team, message us on Whatsapp, or email " +
      business.email +
      ". Customer care is available " +
      business.customerCareHours +
      ". " +
      business.customerCareResponse,
    keywords: "contact human person agent support whatsapp phone email complaint",
    href: business.whatsapp,
    action: "Whatsapp",
  },
  {
    id: "pending-payments",
    category: "Payments",
    question: browseEnquiriesOnly()
      ? "Can I pay online?"
      : "My payment is not confirmed. What should I do?",
    answer: browseEnquiriesOnly()
      ? "Online checkout and payments are not available yet. Contact Allied AutoTech to discuss a product, service or vehicle."
      : "Check the payment status in your account. Returning from checkout does not confirm payment. If confirmation is pending, check again or contact customer care before paying again to avoid a duplicate payment.",
    keywords: "payment paid pending charged failed money transfer",
    href: browseEnquiriesOnly() ? "/contact#enquiry" : "/dashboard/payments",
    action: browseEnquiriesOnly() ? "Send an enquiry" : "Check your payments",
  },
  {
    id: "recover-your-account",
    category: "Accounts and security",
    question: "How do I recover my account?",
    answer:
      "Use Forgot password on the sign-in page and enter your email address. If the account is eligible, a recovery link will be sent. Follow the link to choose a new password.",
    keywords: "password login sign account recover reset",
    href: "/forgot-password",
    action: "Recover your account",
  },
  {
    id: "policies-and-opening-hours",
    category: "Contact and location",
    question: "What are your hours, warranties and refund policies?",
    answer: browseEnquiriesOnly()
      ? `Customer care is available ${business.customerCareHours}. Contact Allied AutoTech for the warranty or refund terms that apply to your request. Our team confirms workshop appointments separately.`
      : "Contact Allied AutoTech for the policy that applies to your request. Current booking terms are shown before you submit, and any payment or refund status is available in your account.",
    keywords: "hours open closing warranty guarantee refund policy returns",
    href: business.whatsapp,
    action: "Ask Allied AutoTech",
  },
  {
    id: "request-a-quotation",
    category: "Quotations",
    question: "How do I request a quotation?",
    answer:
      "Choose a service and review its pricing information. For work that requires a quotation, send an enquiry from the service page with your vehicle details and a description of the issue. You do not need to sign in to send this enquiry. The workshop can discuss your requirements before preparing a quotation. If a quotation is issued for a booking in your account, review it there before accepting or rejecting it.",
    keywords: "quote quotation estimate price cost repair",
    href: "/services",
    action: "Find a service",
  },
  {
    id: "shop-and-collection",
    category: "Shop and collection",
    question: "How do I order the right part?",
    answer: browseEnquiriesOnly()
      ? "Use Find Parts for My Car to choose your vehicle and review the fitment result. Make, model and year identify candidates; only a verified fit confirms the recorded specifications match. If compatibility is unknown or needs verification, ask our team before choosing a part. Send a product enquiry to discuss fitment, availability and collection from the workshop. Online checkout is not available, and an enquiry does not reserve stock."
      : "Use Find Parts for My Car and review the product's fitment result and branch availability. If compatibility is unknown or needs verification, ask our team before choosing a part. New orders are for collection from the workshop only. Review quantities and the total at checkout. Adding an item to your cart does not reserve stock.",
    keywords: "shop parts product compatibility cart collection delivery order stock",
    href: "/parts",
    action: "Browse the shop",
  },
  {
    id: "vehicle-inspections",
    category: "Vehicles and inspections",
    question: "Can I inspect a vehicle before buying?",
    answer:
      "Open a published vehicle listing to review its details, images and any listed condition report. Use the inspection request option and follow its status in your account. Submitting a request does not confirm an inspection appointment.",
    keywords: "vehicle marketplace buy car inspection appointment listing",
    href: "/vehicles",
    action: "Explore vehicles",
  },
  {
    id: "manage-your-garage",
    category: "Profile and vehicles",
    question: "How do I add a vehicle to My Garage?",
    answer:
      "Sign in and open My Garage to add your vehicle details. Keep the make, model, year and registration accurate so you can select the correct vehicle when booking a service. Update your contact details from Profile.",
    keywords: "garage vehicle profile registration make model contact details",
    href: "/dashboard/vehicles",
    action: "Open My Garage",
  },
  {
    id: "account-security",
    category: "Accounts and security",
    question: "How do I protect my account with MFA?",
    answer:
      "Open Security in your account to manage multi-factor authentication. You can set up a supported authenticator app or security key. Save newly issued recovery codes privately; each code works once, and new codes replace the previous set. Never share a password, setup key or recovery code with customer care.",
    keywords: "mfa authenticator security key recovery codes password protect",
    href: "/dashboard/security",
    action: "Open account security",
  },
  {
    id: "lost-authenticator",
    category: "Accounts and security",
    question: "What if I delete my authenticator entry or lose my phone?",
    answer:
      "Deleting the Allied AutoTech entry from your authenticator app does not turn off MFA. The website cannot detect changes made in your app, so the authenticator remains linked to your account. Choose Set up authenticator again on the verification screen or in Security. Verify with a saved, unused recovery code or another linked method, then scan the new QR code and confirm a code from your app. Your selected old registration is removed only after the new one is confirmed. Save the new recovery codes before leaving. If you have no recovery code, other linked method or session already verified with MFA, the verification screen cannot reset your MFA. Contact customer care for guidance. Never share your password, setup key or recovery codes.",
    keywords:
      "mfa authenticator deleted disconnected lost phone recovery codes locked out reset",
    href: "/mfa",
    action: "Open sign-in verification",
  },
  {
    id: "follow-a-support-request",
    category: "Contact and location",
    question: "How do I follow up on a support request?",
    answer:
      "Signed-in customers can open Customer Care to review their conversations and request status. Add relevant details to the existing conversation when following up. For further help, contact the workshop by phone or WhatsApp and reference your request. Do not send payment credentials or security codes.",
    keywords: "support ticket complaint history status follow escalation conversation",
    href: "/dashboard/support",
    action: "Open Customer Care",
  },
];

export function answerFaq(query: string) {
  const words = query.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  const matches = faqs
    .map((faq) => ({
      faq,
      score: words.filter((word) => faq.keywords.split(" ").includes(word)).length,
    }))
    .sort((a, b) => b.score - a.score);
  return matches[0]?.score ? matches[0].faq : null;
}
