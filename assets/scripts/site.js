const root = document.documentElement;
const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#nav-links");
const themeButton = document.querySelector("#theme-toggle");
const themeIcon = themeButton?.querySelector(".theme-icon");
const themeLabel = themeButton?.querySelector(".theme-label");

function setTheme(theme) {
  const isDark = theme === "dark";
  root.dataset.theme = isDark ? "dark" : "light";
  themeButton?.setAttribute("aria-pressed", String(isDark));
  themeButton?.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
  if (themeLabel) themeLabel.textContent = isDark ? "Light" : "Dark";
  if (themeIcon) themeIcon.textContent = isDark ? "☀" : "☾";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#080c14" : "#10151f");
}

let savedTheme;
try {
  savedTheme = window.localStorage.getItem("auro-theme");
} catch (error) {
  console.warn("Unable to read the saved color theme.", error);
}
if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);

themeButton?.addEventListener("click", () => {
  const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
  setTheme(nextTheme);
  try {
    window.localStorage.setItem("auro-theme", nextTheme);
  } catch (error) {
    console.warn("Unable to save the selected color theme.", error);
  }
  if (window.matchMedia("(max-width: 820px)").matches) {
    closeMenu();
    menuButton?.focus();
  }
});

function closeMenu() {
  menuButton?.setAttribute("aria-expanded", "false");
  menuButton?.setAttribute("aria-label", "Open navigation");
  navigation?.classList.remove("is-open");
  document.body.classList.remove("menu-open");
}

menuButton?.addEventListener("click", () => {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
  navigation?.classList.toggle("is-open", !isOpen);
  document.body.classList.toggle("menu-open", !isOpen);
});
document.querySelector(".nav")?.classList.add("navigation-ready");

navigation?.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", closeMenu);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuButton?.getAttribute("aria-expanded") === "true") {
    closeMenu();
    menuButton.focus();
  }
});

const desktopNavigation = window.matchMedia("(min-width: 821px)");
const closeMenuOnDesktop = (event) => {
  if (event.matches) closeMenu();
};
if (desktopNavigation.addEventListener) {
  desktopNavigation.addEventListener("change", closeMenuOnDesktop);
} else {
  desktopNavigation.addListener(closeMenuOnDesktop);
}

const year = document.querySelector("#year");
if (year) year.textContent = String(new Date().getFullYear());

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
if ("IntersectionObserver" in window && typeof Element.prototype.animate === "function" && !reducedMotion.matches) {
  const entranceAnimations = new Set();
  const entranceDirections = new WeakMap();
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      if (reducedMotion.matches) return;
      const offset = entranceDirections.get(entry.target) * Math.min(32, window.innerWidth * .04);
      const animation = entry.target.animate([
        { opacity: 0, transform: `translateX(${offset}px)` },
        { opacity: 1, transform: "translateX(0)" }
      ], {
        duration: 650,
        easing: "cubic-bezier(.2, .7, .3, 1)"
      });
      entranceAnimations.add(animation);
      animation.addEventListener("finish", () => entranceAnimations.delete(animation), { once: true });
    });
  }, { threshold: 0.1 });

  document.querySelectorAll(
    ".about-copy, .section-heading, .service-card, .process-intro, .process-steps article, .faq-heading, .faq-item, .contact-copy, .contact-form"
  ).forEach((target, index) => {
    entranceDirections.set(target, index % 2 === 0 ? -1 : 1);
    revealObserver.observe(target);
  });

  const stopEntranceAnimations = (event) => {
    if (!event.matches) return;
    revealObserver.disconnect();
    entranceAnimations.forEach((animation) => animation.cancel());
    entranceAnimations.clear();
  };
  if (reducedMotion.addEventListener) {
    reducedMotion.addEventListener("change", stopEntranceAnimations);
  } else {
    reducedMotion.addListener(stopEntranceAnimations);
  }
}

const serviceSelect = document.querySelector('#contact-form select[name="service"]');
document.querySelectorAll(".service-card a[data-service]").forEach((link) => {
  link.addEventListener("click", () => {
    if (serviceSelect && link.dataset.service) {
      serviceSelect.value = link.dataset.service;
      serviceSelect.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
});

const contactForm = document.querySelector("#contact-form");
const formStatus = document.querySelector("#form-status");
const enquiryPreview = document.querySelector("#enquiry-preview");
const enquiryText = document.querySelector("#enquiry-text");
const openEnquiryEmail = document.querySelector("#open-enquiry-email");
const copyEnquiry = document.querySelector("#copy-enquiry");

if (contactForm && enquiryPreview && enquiryText && openEnquiryEmail && copyEnquiry && formStatus) {
  contactForm.noValidate = true;
  const enquiryFields = contactForm.querySelectorAll("input, select, textarea:not([readonly])");

  function invalidateEnquiry() {
    enquiryPreview.hidden = true;
    enquiryText.value = "";
    openEnquiryEmail.removeAttribute("href");
    formStatus.textContent = "";
  }

  enquiryFields.forEach((field) => {
    const clearFieldError = () => {
      field.setCustomValidity("");
      field.removeAttribute("aria-invalid");
      invalidateEnquiry();
    };
    field.addEventListener("input", clearFieldError);
    field.addEventListener("change", clearFieldError);
  });

  contactForm.addEventListener("reset", () => {
    enquiryFields.forEach((field) => {
      field.setCustomValidity("");
      field.removeAttribute("aria-invalid");
    });
    invalidateEnquiry();
  });

  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    invalidateEnquiry();
    enquiryFields.forEach((field) => {
      field.value = field.value.trim();
      field.setCustomValidity("");
      if (field.required && !field.value) {
        field.setCustomValidity("Please complete this required field.");
      } else if (field.maxLength > 0 && field.value.length > field.maxLength) {
        field.setCustomValidity(`Please use ${field.maxLength} characters or fewer.`);
      }
      field.setAttribute("aria-invalid", String(!field.validity.valid));
    });
    if (!contactForm.checkValidity()) {
      formStatus.textContent = "Please correct the highlighted fields before preparing your enquiry.";
      contactForm.reportValidity();
      return;
    }

    const formData = new FormData(contactForm);
    const subject = `Project enquiry: ${formData.get("service")}`;
    const recipient = "bestresearchsolutions62@gmail.com";
    const body = [
      `Name: ${formData.get("name")}`,
      `Email: ${formData.get("email")}`,
      `Phone: ${formData.get("phone") || "Not provided"}`,
      `Service: ${formData.get("service")}`,
      "",
      "Project details:",
      String(formData.get("message"))
    ].join("\r\n");

    enquiryText.value = `To: ${recipient}\r\nSubject: ${subject}\r\n\r\n${body}`;
    openEnquiryEmail.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    enquiryPreview.hidden = false;
    formStatus.textContent = "Enquiry prepared, not sent. Review the details below and choose how to send it.";
    enquiryText.focus();
  });

  copyEnquiry.addEventListener("click", async () => {
    const text = enquiryText.value;
    if (!text || enquiryPreview.hidden) return;

    function selectForManualCopy() {
      enquiryText.focus();
      enquiryText.select();
      formStatus.textContent = "Copy is unavailable. The enquiry is selected; use your device's Copy command, then paste it into your email service.";
    }

    if (!navigator.clipboard?.writeText) {
      selectForManualCopy();
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.warn("Unable to copy the enquiry to the clipboard.", error);
      if (enquiryText.value === text && !enquiryPreview.hidden) selectForManualCopy();
      return;
    }
    if (enquiryText.value === text && !enquiryPreview.hidden) {
      formStatus.textContent = "Enquiry copied. Paste it into your email service and send it to the address shown. Nothing has been sent yet.";
    }
  });
  contactForm.querySelector('button[type="submit"]').disabled = false;
}
