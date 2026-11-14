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
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#080c14" : "#f4f8ff");
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

const sectionLinks = Array.from(navigation?.querySelectorAll('a[href^="#"]') || []);
const linkedSections = sectionLinks.map((link) => ({
  link,
  section: document.getElementById(link.hash.slice(1))
})).filter(({ section }) => section);
let sectionUpdatePending = false;
function updateCurrentSection() {
  const marker = (document.querySelector(".site-header")?.getBoundingClientRect().height || 0) + 24;
  let current = null;
  linkedSections.forEach(({ link, section }) => {
    if (section.getBoundingClientRect().top <= marker) current = link;
  });
  if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2 && linkedSections.length) {
    current = linkedSections[linkedSections.length - 1].link;
  }
  sectionLinks.forEach((link) => {
    if (link === current) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
  sectionUpdatePending = false;
}
function scheduleSectionUpdate() {
  if (!sectionUpdatePending) {
    sectionUpdatePending = true;
    window.requestAnimationFrame(updateCurrentSection);
  }
}
window.addEventListener("scroll", scheduleSectionUpdate, { passive: true });
window.addEventListener("resize", scheduleSectionUpdate);
scheduleSectionUpdate();

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

const serviceFilterButtons = document.querySelectorAll("[data-service-filter]");
const serviceCards = document.querySelectorAll(".service-card[data-service-category]");
const serviceFilterStatus = document.querySelector("#service-filter-status");
if (serviceFilterButtons.length && serviceCards.length && serviceFilterStatus) {
  let selectedFilter = "all";
  function updateServices() {
    let visibleCount = 0;
    serviceFilterButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.serviceFilter === selectedFilter));
    });
    serviceCards.forEach((card) => {
      card.hidden = selectedFilter !== "all" && card.dataset.serviceCategory !== selectedFilter;
      if (!card.hidden) visibleCount++;
    });
    const selectedButton = Array.from(serviceFilterButtons).find((button) => button.dataset.serviceFilter === selectedFilter);
    const category = selectedFilter === "all" ? "" : ` for ${selectedButton.textContent.trim()}`;
    serviceFilterStatus.textContent = `Showing ${visibleCount} ${visibleCount === 1 ? "service" : "services"}${category}.`;
    scheduleSectionUpdate();
  }
  serviceFilterButtons.forEach((button) => {
    button.hidden = false;
    button.addEventListener("click", () => {
      selectedFilter = button.dataset.serviceFilter;
      updateServices();
    });
  });
  updateServices();
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
if ("IntersectionObserver" in window && typeof Element.prototype.animate === "function" && !reducedMotion.matches) {
  const entranceAnimations = new Set();
  const entranceDelays = new WeakMap();
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      if (reducedMotion.matches) return;
      const animation = entry.target.animate([
        { opacity: 0, transform: "translateY(18px)" },
        { opacity: 1, transform: "translateY(0)" }
      ], {
        duration: 550,
        delay: entranceDelays.get(entry.target) || 0,
        easing: "cubic-bezier(.2, .7, .3, 1)"
      });
      entranceAnimations.add(animation);
      animation.addEventListener("finish", () => entranceAnimations.delete(animation), { once: true });
    });
  }, { threshold: 0.1 });

  document.querySelectorAll(
    ".about-copy, .section-heading, .service-card, .process-intro, .process-steps article, .faq-heading, .faq-item, .contact-copy, .contact-form"
  ).forEach((target) => {
    if (target.matches(".service-card")) {
      const cards = Array.from(target.parentElement.children);
      const columns = getComputedStyle(target.parentElement).gridTemplateColumns.trim().split(/\s+/).length;
      entranceDelays.set(target, (cards.indexOf(target) % columns) * 90);
    }
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
const messageField = document.querySelector('#contact-form textarea[name="message"]');
const messageCount = document.querySelector("#message-count");

if (contactForm && formStatus && messageField && messageCount) {
  contactForm.noValidate = true;
  const enquiryFields = contactForm.querySelectorAll("input, select, textarea:not([readonly])");

  function updateMessageCount() {
    const count = messageField.value.length;
    messageCount.textContent = `${count} / ${messageField.maxLength}`;
    messageCount.classList.toggle("is-near-limit", count >= messageField.maxLength * 0.9);
  }
  updateMessageCount();
  messageField.addEventListener("input", updateMessageCount);

  enquiryFields.forEach((field) => {
    const clearFieldError = () => {
      field.setCustomValidity("");
      field.removeAttribute("aria-invalid");
      formStatus.textContent = "";
    };
    field.addEventListener("input", clearFieldError);
    field.addEventListener("change", clearFieldError);
  });

  contactForm.addEventListener("reset", () => {
    enquiryFields.forEach((field) => {
      field.setCustomValidity("");
      field.removeAttribute("aria-invalid");
    });
    formStatus.textContent = "";
    window.setTimeout(updateMessageCount, 0);
  });

  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    formStatus.textContent = "";
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
    updateMessageCount();
    if (!contactForm.checkValidity()) {
      formStatus.textContent = "Please correct the highlighted fields before preparing your enquiry.";
      contactForm.reportValidity();
      return;
    }

    const formData = new FormData(contactForm);
    const subject = `Project enquiry: ${formData.get("service")}`;
    const recipient = "bestresearchsolutions62@gmail.com";
    const body = [
      "Dear AURO INFO TECH Team,",
      "",
      `I would like to enquire about your ${formData.get("service")} service. Please find my project requirements and contact details below.`,
      "",
      "PROJECT REQUIREMENTS",
      String(formData.get("message")),
      "",
      ...(formData.get("timeline") ? [`Preferred timeline: ${formData.get("timeline")}`, ""] : []),
      "CONTACT DETAILS",
      `Name: ${formData.get("name")}`,
      `Email: ${formData.get("email")}`,
      ...(formData.get("phone") ? [`Phone: ${formData.get("phone")}`] : []),
      "",
      "Please let me know whether you can assist with this project, along with the proposed approach, estimated cost, and expected timeline. I would be happy to discuss any additional information you need.",
      "",
      "Thank you for your time. I look forward to hearing from you.",
      "",
      "Kind regards,",
      String(formData.get("name"))
    ].join("\r\n");

    const emailLink = document.createElement("a");
    emailLink.href = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipient)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    emailLink.target = "_blank";
    emailLink.rel = "noopener noreferrer";
    formStatus.textContent = "Your enquiry has not been sent. Sign in to Gmail if needed and send it yourself. If no tab opens, allow pop-ups or use the Gmail link above.";
    emailLink.click();
  });
  contactForm.querySelector('button[type="submit"]').disabled = false;
}
