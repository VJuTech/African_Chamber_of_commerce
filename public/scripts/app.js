// Shared client-side enhancements used across account and profile pages.
document.addEventListener("DOMContentLoaded", () => {
  const currentPath = window.location.pathname;

  document.querySelectorAll(".nav-links a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href === "#") return;

    const normalizedHref = href.split("?")[0];
    const isHomeLink = normalizedHref === "/";
    const isActiveLink = isHomeLink
      ? currentPath === "/"
      : currentPath === normalizedHref || currentPath.startsWith(normalizedHref + "/");

    if (isActiveLink) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });

  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");

  if (navToggle && navLinks) {
    const syncNavState = () => {
      if (window.innerWidth > 767) {
        navToggle.setAttribute("aria-expanded", "false");
        navLinks.classList.remove("nav-links--open");
      }
    };

    navToggle.addEventListener("click", () => {
      const isExpanded = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!isExpanded));
      navLinks.classList.toggle("nav-links--open", !isExpanded);
    });

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        if (window.innerWidth <= 980) {
          navToggle.setAttribute("aria-expanded", "false");
          navLinks.classList.remove("nav-links--open");
        }
      });
    });

    window.addEventListener("resize", syncNavState);
    syncNavState();
  }

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
