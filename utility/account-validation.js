// Utility functions for validating account-related input.
// This keeps registration and login rules centralized and reusable.

function validateRequiredFields(fields, data) {
  const errors = [];

  fields.forEach((field) => {
    const value = data[field];
    if (value === undefined || value === null || String(value).trim() === "") {
      errors.push(`${field} is required.`);
    }
  });

  return errors;
}

function validateEmail(email) {
  const errors = [];

  if (!email || String(email).trim() === "") {
    errors.push("Email is required.");
    return errors;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(String(email).trim())) {
    errors.push("Email format is invalid.");
  }

  return errors;
}

function validatePhone(phone) {
  const errors = [];

  if (!phone || String(phone).trim() === "") {
    errors.push("Mobile number is required.");
    return errors;
  }

  const phonePattern = /^\+?[0-9()\-\s]{7,20}$/;
  if (!phonePattern.test(String(phone).trim())) {
    errors.push("Mobile number format is invalid.");
  }

  return errors;
}

function validatePassword(password, password2 = null) {
  const errors = [];

  if (!password || String(password).trim() === "") {
    errors.push("Password is required.");
    return errors;
  }

  const passwordString = String(password);
  if (passwordString.length < 8) {
    errors.push("Password must be at least 8 characters long.");
  }

  if (!/[A-Z]/.test(passwordString)) {
    errors.push("Password must contain at least one uppercase letter.");
  }

  if (!/[a-z]/.test(passwordString)) {
    errors.push("Password must contain at least one lowercase letter.");
  }

  if (!/[0-9]/.test(passwordString)) {
    errors.push("Password must contain at least one numeric digit.");
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(passwordString)) {
    errors.push("Password must contain at least one special character.");
  }

  if (password2 !== null && password2 !== undefined && String(password) !== String(password2)) {
    errors.push("Passwords do not match.");
  }

  return errors;
}

function validateConsent(name, value) {
  if (value === undefined || value === null || value === false || value === "false" || String(value).trim() === "") {
    return [`You must accept the ${name}.`];
  }
  return [];
}

function validateAccountPayload(payload) {
  const errors = [];
  const firstName = payload.firstName ?? payload.first_name ?? payload.name;
  const lastName = payload.lastName ?? payload.last_name;
  const phone = payload.phone ?? payload.mobile;
  const password2 = payload.password2 ?? payload.confirmPassword ?? null;
  const acceptedTerms = payload.acceptTerms ?? payload.acceptedTerms ?? payload.terms ?? payload.termsAccepted;
  const acceptedPrivacy = payload.acceptPrivacy ?? payload.acceptedPrivacy ?? payload.privacy ?? payload.privacyAccepted;

  errors.push(...validateRequiredFields(["firstName", "lastName", "email", "phone", "country", "password", "password2"], {
    firstName,
    lastName,
    email: payload.email,
    phone,
    country: payload.country,
    password: payload.password,
    password2,
  }));
  errors.push(...validateEmail(payload.email));
  errors.push(...validatePhone(phone));
  errors.push(...validatePassword(payload.password, password2));
  errors.push(...validateConsent("Terms of Service", acceptedTerms));
  errors.push(...validateConsent("Privacy Policy", acceptedPrivacy));

  return errors;
}

module.exports = {
  validateRequiredFields,
  validateEmail,
  validatePhone,
  validatePassword,
  validateConsent,
  validateAccountPayload,
};
