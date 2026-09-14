export const business = {
  name: "Allied AutoTech",
  address: "133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria",
  phone: "08136075567",
  internationalPhone: "+2348136075567",
  whatsapp: "https://wa.me/2348136075567",
  email: "alliedautotech26@gmail.com",
  socialHandle: "@AlliedAutoTech",
  directions:
    "https://www.google.com/maps/dir/?api=1&destination=" +
    encodeURIComponent(
      "133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria",
    ),
} as const;

export const faqs = [
  {
    question: "How do I book a service?",
    answer:
      "Open Services, choose a service and review its availability. Fixed-price appointments use published time slots. Sign in to submit your booking and review the deposit policy before continuing.",
    keywords: "book appointment service slot time",
    href: "/services",
    action: "Explore services",
  },
  {
    question: "Where is Allied AutoTech?",
    answer: business.address + ". Contact us if you need help finding the workshop.",
    keywords: "location address map directions workshop visit",
    href: business.directions,
    action: "Get directions",
  },
  {
    question: "How can I speak to someone?",
    answer:
      "Call " +
      business.phone +
      ", message us on WhatsApp, or email " +
      business.email +
      ". Signed-in customers can also open a customer-care conversation. Response availability is not shown here.",
    keywords: "contact human person agent support whatsapp phone email complaint",
    href: business.whatsapp,
    action: "Message on WhatsApp",
  },
  {
    question: "My payment is not confirmed. What should I do?",
    answer:
      "Check the payment status in your account. Returning from checkout does not confirm payment. If confirmation is pending, check again or contact customer care before paying again to avoid a duplicate payment.",
    keywords: "payment paid pending charged failed money transfer",
    href: "/dashboard/payments",
    action: "Check your payments",
  },
  {
    question: "How do I recover my account?",
    answer:
      "Use Forgot password on the sign-in page and enter your email address. If the account is eligible, a recovery link will be sent. Follow the link to choose a new password.",
    keywords: "password login sign account recover reset",
    href: "/forgot-password",
    action: "Recover your account",
  },
  {
    question: "What are your hours, warranties and refund policies?",
    answer:
      "These business details have not been published here. Contact Allied AutoTech for the policy that applies to your request. Any booking deposit terms are shown before you submit a booking.",
    keywords: "hours open closing warranty guarantee refund policy returns",
    href: business.whatsapp,
    action: "Ask Allied AutoTech",
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
