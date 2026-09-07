const africanCountryData = [
  ["Algeria", "DZ"], ["Angola", "AO"], ["Benin", "BJ"], ["Botswana", "BW"], ["Burkina Faso", "BF"],
  ["Burundi", "BI"], ["Cabo Verde", "CV"], ["Cameroon", "CM"], ["Central African Republic", "CF"],
  ["Chad", "TD"], ["Comoros", "KM"], ["Democratic Republic of the Congo", "CD"], ["Republic of the Congo", "CG"],
  ["Cote d'Ivoire", "CI"], ["Djibouti", "DJ"], ["Egypt", "EG"], ["Equatorial Guinea", "GQ"], ["Eritrea", "ER"],
  ["Eswatini", "SZ"], ["Ethiopia", "ET"], ["Gabon", "GA"], ["The Gambia", "GM"], ["Ghana", "GH"], ["Guinea", "GN"],
  ["Guinea-Bissau", "GW"], ["Kenya", "KE"], ["Lesotho", "LS"], ["Liberia", "LR"], ["Libya", "LY"], ["Madagascar", "MG"],
  ["Malawi", "MW"], ["Mali", "ML"], ["Mauritania", "MR"], ["Mauritius", "MU"], ["Morocco", "MA"], ["Mozambique", "MZ"],
  ["Namibia", "NA"], ["Niger", "NE"], ["Nigeria", "NG"], ["Rwanda", "RW"], ["Sao Tome and Principe", "ST"],
  ["Senegal", "SN"], ["Seychelles", "SC"], ["Sierra Leone", "SL"], ["Somalia", "SO"], ["South Africa", "ZA"],
  ["South Sudan", "SS"], ["Sudan", "SD"], ["Tanzania", "TZ"], ["Togo", "TG"], ["Tunisia", "TN"], ["Uganda", "UG"],
  ["Zambia", "ZM"], ["Zimbabwe", "ZW"],
];

function countryFlag(code) {
  return code
    .toUpperCase()
    .split("")
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

const africanCountries = africanCountryData.map(([name, code]) => ({
  name,
  code,
  flag: countryFlag(code),
  flagUrl: `https://flagcdn.com/w40/${code.toLowerCase()}.png`,
}));

// ISIC-aligned categories, expanded into the sectors commonly used by global business directories.
const industryCategories = [
  "Agriculture, forestry and fishing", "Mining and quarrying", "Manufacturing", "Electricity, gas, steam and air conditioning",
  "Water supply, sewerage, waste management and remediation", "Construction", "Wholesale and retail trade",
  "Transportation and storage", "Accommodation and food service", "Information and communication",
  "Financial and insurance activities", "Real estate activities", "Professional, scientific and technical services",
  "Administrative and support services", "Public administration and defence", "Education", "Human health and social work",
  "Arts, entertainment and recreation", "Other service activities", "Household employment", "International organizations",
  "Aerospace and aviation", "Automotive", "Banking", "Biotechnology", "Chemicals", "Clean energy and utilities",
  "Computer hardware", "Consumer goods", "Cybersecurity", "E-commerce", "Engineering", "Environmental services",
  "Fashion and apparel", "Food and beverage", "Healthcare technology", "Hospitality and tourism", "Insurance",
  "Legal services", "Logistics and supply chain", "Marketing and advertising", "Media and publishing",
  "Medical devices and pharmaceuticals", "Nonprofit and social enterprise", "Oil and gas", "Payments and fintech",
  "Personal services", "Professional services", "Real estate development", "Renewable energy", "Research and development",
  "Restaurants and catering", "Retail technology", "Software and SaaS", "Sports and fitness", "Telecommunications",
  "Textiles", "Venture capital and private equity", "Wholesale distribution", "Other",
];

module.exports = { africanCountries, industryCategories };
