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

  // Keep mega-menu state predictable for mouse, keyboard, and touch navigation.
  const megaMenus = document.querySelectorAll("[data-nav-menu]");
  const closeMegaMenus = () => {
    megaMenus.forEach((menu) => {
      menu.classList.remove("is-open");
      const trigger = menu.querySelector(".nav-menu__trigger");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    });
  };

  megaMenus.forEach((menu) => {
    const trigger = menu.querySelector(".nav-menu__trigger");
    if (!trigger) return;

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const shouldOpen = !menu.classList.contains("is-open");
      closeMegaMenus();
      menu.classList.toggle("is-open", shouldOpen);
      trigger.setAttribute("aria-expanded", String(shouldOpen));
    });

    menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMegaMenus));
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-nav-menu]")) closeMegaMenus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMegaMenus();
  });

  // Let workspace navigation groups expand independently without changing routes.
  document.querySelectorAll("[data-sidebar-group]").forEach((group) => {
    const toggle = group.querySelector(".workspace-sidebar__toggle");
    if (!toggle) return;

    toggle.addEventListener("click", () => {
      const isExpanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!isExpanded));
      group.classList.toggle("is-expanded", !isExpanded);
    });
  });

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
