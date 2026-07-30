// Utility functions for validating account-related input.
// This keeps registration and login rules centralized and reusable.

function validateRequiredFields(fields, data) {
  const errors = [];

  fields.forEach((field) => {
    if (!data[field] || String(data[field]).trim() === "") {
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

function validatePassword(password, password2 = null) {
  const errors = [];

  if (!password || String(password).trim() === "") {
    errors.push("Password is required.");
    return errors;
  }

  if (String(password).length < 8) {
    errors.push("Password must be at least 8 characters long.");
  }

  if (password2 !== null && String(password) !== String(password2)) {
    errors.push("Passwords do not match.");
  }

  return errors;
}

function validateAccountPayload(payload) {
  const errors = [];

  errors.push(...validateRequiredFields(["name", "email", "password", "password2"], payload));
  errors.push(...validateEmail(payload.email));
  errors.push(...validatePassword(payload.password, payload.password2));

  return errors;
}

module.exports = {
  validateRequiredFields,
  validateEmail,
  validatePassword,
  validateAccountPayload,
};
