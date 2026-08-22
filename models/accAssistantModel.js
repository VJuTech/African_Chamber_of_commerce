const accKnowledge = {
  goal: "The goal of ACC is to help businesses across Africa build trusted relationships, discover opportunities, grow sustainably, and participate in a connected regional commerce ecosystem.",
  ideal: "The ideal of ACC is a transparent, trusted, and inclusive platform where businesses can connect, verify one another, access services, and create shared economic growth across Africa.",
  currentStage: "The current ACC platform includes membership management, business registration, profile management, networking, marketplace, order handling, trust/review systems, event planning, and payment processing. It is now a practical digital operating system for chamber-led business growth.",
  mission: "ACC exists to empower African businesses with the tools, visibility, and trust infrastructure they need to grow locally and internationally.",
  values: ["trust", "connection", "opportunity", "growth", "inclusion", "verification"]
};

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
  },
  {
    keywords: ["goal", "objective", "purpose", "mission", "why acc", "what is the goal of acc"],
    answer: `${accKnowledge.goal} ${accKnowledge.mission}`
  },
  {
    keywords: ["ideal", "vision", "future", "what is the ideal of acc", "ideal of acc"],
    answer: accKnowledge.ideal
  },
  {
    keywords: ["current stage", "what stage", "progress", "how mature", "what is implemented", "what does acc have now"],
    answer: accKnowledge.currentStage
  }
];

function normalizeQuestion(question = "") {
  return String(question || "").toLowerCase().trim();
}

function getAssistantMemory() {
  return {
    ...accKnowledge,
    lastUpdated: new Date().toISOString(),
    phase: "chapter-19-complete"
  };
}

function getAssistantReply(question, options = {}) {
  const normalized = normalizeQuestion(question);
  const includeMemory = !!(options && options.includeMemory);

  if (!normalized) {
    const baseReply = "I can help with ACC membership, networking, business registration, and platform support. Ask me anything about the African Chamber of Commerce.";
    return includeMemory ? { answer: baseReply, memory: getAssistantMemory() } : baseReply;
  }

  for (const entry of faqEntries) {
    const matches = entry.keywords.some((keyword) => normalized.includes(keyword));
    if (matches) {
      const response = includeMemory ? { answer: entry.answer, memory: getAssistantMemory() } : entry.answer;
      return response;
    }
  }

  if (normalized.includes("hello") || normalized.includes("hi") || normalized.includes("hey")) {
    const response = "Hello! I’m the ACC assistant. I can answer questions about joining ACC, networking, profiles, directories, and business growth.";
    return includeMemory ? { answer: response, memory: getAssistantMemory() } : response;
  }

  if (normalized.includes("thank")) {
    const response = "You’re welcome. I’m here to help with anything related to ACC membership, business growth, or platform support.";
    return includeMemory ? { answer: response, memory: getAssistantMemory() } : response;
  }

  const fallbackReply = "I can help with ACC membership, business registration, networking, profiles, and platform support. For example, you can ask how to join, how to connect with businesses, or how to update your profile.";
  const enriched = `${fallbackReply} ${accKnowledge.goal}`;
  return includeMemory ? { answer: enriched, memory: getAssistantMemory() } : enriched;
}

module.exports = {
  getAssistantReply,
  getAssistantMemory,
};
