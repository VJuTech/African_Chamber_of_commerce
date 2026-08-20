const faqEntries = [
  {
    keywords: ["member", "membership", "join", "become a member", "become member", "register"],
    answer: "To join ACC, create an account, choose your membership type, and complete your profile. Once approved, you can access networking, business listings, and growth opportunities."
  },
  {
    keywords: ["network", "connect", "businesses", "partner", "partners", "partnership"],
    answer: "ACC helps you connect with verified businesses and professionals through the directory and networking tools. You can send connection requests, view member profiles, and build business relationships safely."
  },
  {
    keywords: ["business", "register business", "create business", "company"],
    answer: "You can register a business from the Dashboard by selecting 'Register Business.' Add your company details, review the verification steps, and publish your profile for partners and clients."
  },
  {
    keywords: ["directory", "find company", "supplier", "client", "discover"],
    answer: "Use the Business Directory to search by industry, location, and business type. This helps you discover trusted suppliers, buyers, and service providers across Africa."
  },
  {
    keywords: ["profile", "edit profile", "my profile", "account"],
    answer: "Visit your Profile page to update contact details, upload your information, and manage your public visibility. A complete profile improves trust and makes networking easier."
  },
  {
    keywords: ["pricing", "plan", "membership fee", "upgrade", "downgrade", "subscription"],
    answer: "ACC offers membership plans with different access levels. You can review your current plan, upgrade to unlock more visibility, or manage changes from the Membership section."
  },
  {
    keywords: ["support", "help", "contact", "question", "assist"],
    answer: "ACC support can help with membership, profile setup, business verification, and networking issues. For more detailed help, use the platform dashboard and complete the relevant profile or membership flow."
  },
  {
    keywords: ["about", "what is acc", "african chamber", "platform"],
    answer: "The African Chamber of Commerce (ACC) is a digital ecosystem that connects businesses across Africa through trusted networking, member verification, business discovery, and growth opportunities."
  }
];

function normalizeQuestion(question = "") {
  return String(question || "").toLowerCase().trim();
}

function getAssistantReply(question) {
  const normalized = normalizeQuestion(question);

  if (!normalized) {
    return "I can help with ACC membership, networking, business registration, and platform support. Ask me anything about the African Chamber of Commerce.";
  }

  for (const entry of faqEntries) {
    const matches = entry.keywords.some((keyword) => normalized.includes(keyword));
    if (matches) {
      return entry.answer;
    }
  }

  if (normalized.includes("hello") || normalized.includes("hi") || normalized.includes("hey")) {
    return "Hello! I’m the ACC assistant. I can answer questions about joining ACC, networking, profiles, directories, and business growth.";
  }

  if (normalized.includes("thank")) {
    return "You’re welcome. I’m here to help with anything related to ACC membership, business growth, or platform support.";
  }

  return "I can help with ACC membership, business registration, networking, profiles, and platform support. For example, you can ask how to join, how to connect with businesses, or how to update your profile.";
}

module.exports = {
  getAssistantReply,
};
