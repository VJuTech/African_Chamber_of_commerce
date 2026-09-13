const accKnowledge = {
  goal: "The goal of ACC is to help businesses across Africa build trusted relationships, discover opportunities, grow sustainably, and participate in a connected regional commerce ecosystem.",
  ideal: "The ideal of ACC is a transparent, trusted, and inclusive platform where businesses can connect, verify one another, access services, and create shared economic growth across Africa.",
  currentStage: "The current ACC platform includes membership management, business registration, profile management, networking, marketplace, order handling, trust/review systems, event planning, and payment processing. It is now a practical digital operating system for chamber-led business growth.",
  mission: "ACC exists to empower African businesses with the tools, visibility, and trust infrastructure they need to grow locally and internationally.",
  values: ["trust", "connection", "opportunity", "growth", "inclusion", "verification"],
  links: {
    home: "/",
    directory: "/directory",
    marketplace: "/marketplace",
    events: "/events",
    networking: "/network",
    membership: "/subscriptions",
    register: "/register",
    login: "/login",
    assistant: "/assistant",
    apiDocs: "/api/docs",
    notifications: "/notifications"
  }
};

const restrictedTopics = [
  "admin", "administrator", "management dashboard", "control center", "control centre", "admin dashboard",
  "security", "password", "mfa", "two factor", "two-factor", "authentication policy", "access token",
  "api key", "secret", "user data", "user information", "user list", "users list", "member records", "account data",
  "private information", "personal information", "email address", "phone number", "login details", "account details",
  "customer records", "roles", "permissions", "access control"
];

const escalationTopics = ["speak to an agent", "talk to an agent", "customer care", "customer support", "human agent", "live agent", "representative"];

const faqEntries = [
  {
    keywords: ["member", "membership", "join", "become a member", "become member", "register"],
    answer: "To join ACC, create an account at /register, verify your account, and complete your profile. Once active, you can access networking, business listings, and growth opportunities."
  },
  {
    keywords: ["network", "connect", "businesses", "partner", "partners", "partnership"],
    answer: "ACC helps you connect with verified businesses and professionals through the Business Directory at /directory and Networking at /network. You can send connection requests, view public member profiles, and build business relationships."
  },
  {
    keywords: ["business", "register business", "create business", "company"],
    answer: "After joining and verifying your account, open your member workspace and choose Register Business. Add your company details, review the verification steps, and publish your profile for partners and clients."
  },
  {
    keywords: ["directory", "find company", "supplier", "client", "discover"],
    answer: "Use the Business Directory at /directory to search by industry, location, and business type. This helps you discover suppliers, buyers, and service providers across Africa."
  },
  {
    keywords: ["profile", "edit profile", "my profile", "account"],
    answer: "Sign in at /login and open your member profile to update your public business presence and preferences. A complete profile improves trust and makes networking easier."
  },
  {
    keywords: ["pricing", "plan", "membership fee", "upgrade", "downgrade", "subscription"],
    answer: "Review ACC membership plans at /subscriptions. Plans can provide different levels of visibility, listings, support, and business tools."
  },
  {
    keywords: ["support", "help", "contact", "question", "assist"],
    answer: "I can help with membership, profile setup, business verification, networking, marketplace, events, and platform navigation. You can also request customer care using the Speak with customer care button."
  },
  {
    keywords: ["about", "what is acc", "african chamber", "platform"],
    answer: "The African Chamber of Commerce (ACC) is a digital ecosystem that connects businesses across Africa through trusted networking, member verification, business discovery, events, marketplace opportunities, and growth tools. Start at / or create an account at /register."
  },
  {
    keywords: ["goal", "objective", "purpose", "mission", "why acc", "what is the goal of acc"],
    answer: `${accKnowledge.goal} ${accKnowledge.mission}`
  },
  {
    keywords: ["ideal", "vision", "future", "what is the ideal of acc", "ideal of acc"],
    answer: `${accKnowledge.ideal} Explore the public network at /directory, /marketplace, and /events.`
  },
  {
    keywords: ["current stage", "what stage", "progress", "how mature", "what is implemented", "what does acc have now"],
    answer: accKnowledge.currentStage
  }
];

function normalizeQuestion(question = "") {
  return String(question || "").toLowerCase().trim();
}

function isRestrictedTopic(normalized) {
  return restrictedTopics.some((topic) => normalized.includes(topic));
}

function wantsAgent(normalized) {
  return escalationTopics.some((topic) => normalized.includes(topic));
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

  if (isRestrictedTopic(normalized)) {
    const response = "I can help with public ACC platform features and member workflows, but I cannot provide management, user, or security information. You can request customer care for assistance with an account or platform issue.";
    return includeMemory ? { answer: response, memory: getAssistantMemory(), restricted: true } : response;
  }

  if (wantsAgent(normalized)) {
    const response = "I can arrange a customer-care handoff. Use the Speak with customer care button so an authorized ACC representative can continue from this conversation.";
    return includeMemory ? { answer: response, memory: getAssistantMemory(), escalationRequested: true } : response;
  }

  if (!normalized) {
    const baseReply = "I can help with ACC membership, business registration, networking, the directory, marketplace, events, subscriptions, public API documentation, and platform navigation. Ask me about any public ACC feature.";
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
    const response = "Hello! I’m the ACC assistant. I can answer questions about joining ACC, networking, profiles, directories, marketplace, events, and business growth.";
    return includeMemory ? { answer: response, memory: getAssistantMemory() } : response;
  }

  if (normalized.includes("thank")) {
    const response = "You’re welcome. I’m here to help with anything related to ACC membership, business growth, or platform support.";
    return includeMemory ? { answer: response, memory: getAssistantMemory() } : response;
  }

  const fallbackReply = "I can help with ACC membership, business registration, networking, profiles, directory discovery, marketplace, events, subscriptions, and public API documentation. For example, ask how to join, connect with businesses, browse opportunities, or attend an event.";
  const enriched = `${fallbackReply} ${accKnowledge.goal}`;
  return includeMemory ? { answer: enriched, memory: getAssistantMemory() } : enriched;
}

module.exports = {
  getAssistantReply,
  getAssistantMemory,
  isRestrictedTopic,
  wantsAgent,
};
