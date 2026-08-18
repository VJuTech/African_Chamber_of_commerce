// Shared client-side enhancements used across account and profile pages.
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".password-toggle-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const targetId = button.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;

      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      button.title = isPassword ? "Hide password" : "Toggle password visibility";
      button.classList.toggle("active", !isPassword);
    });
  });

  const passwordInput = document.getElementById("password") || document.getElementById("newPassword");
  if (passwordInput) {
    passwordInput.addEventListener("input", () => {
      const password = passwordInput.value;
      const requirements = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password),
        special: /[!@#$%^&*()_+\-=\[\]{};':\",.<>/?]/.test(password),
      };

      document.querySelectorAll(".requirement-list li").forEach((item) => {
        const requirement = item.dataset.requirement;
        item.classList.toggle("met", Boolean(requirements[requirement]));
      });
    });
  }
});
