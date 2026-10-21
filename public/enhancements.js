import { institutionEmail } from "./site.js";
import {
  readPreferences,
  savePreferences,
  captureCampaign,
} from "./preferences.js";

let ui, preferences, attribution;
const storage = (kind) => {
  try {
    return window[kind];
  } catch {
    return { getItem: () => null, setItem() {}, removeItem() {} };
  }
};

export function initializeEnhancements(options) {
  ui = options;
  const { h, btn, icon } = ui;
  preferences = readPreferences(storage("localStorage"));
  attribution = captureCampaign(
    location.search,
    preferences?.campaignTracking,
    storage("sessionStorage"),
  );
  const progress = h("progress", {
    id: "scroll-progress",
    max: 100,
    value: 0,
    "aria-label": "Page scroll progress",
    "aria-hidden": "true",
  });
  const requests = h("div", {
    id: "request-progress",
    "aria-hidden": "true",
    hidden: true,
  });
  const back = btn(
    "Back to top",
    () => {
      document.querySelector("#main")?.focus({ preventScroll: true });
      window.scrollTo({
        top: 0,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    },
    "floating-button back-to-top",
    "up",
  );
  back.title = "Back to top";
  back.hidden = true;
  const contact = btn(
    "Contact",
    openContact,
    "floating-button contact-button",
    "mail",
  );
  contact.title = "Contact & help";
  const tools = h("div", { class: "floating-tools" }, back, contact);
  document.body.append(
    progress,
    requests,
    tools,
    h("div", { id: "cookie-banner" }),
  );
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.hidden = max < 2;
    progress.value =
      max > 0 ? Math.min(100, Math.max(0, (scrollY / max) * 100)) : 0;
    back.hidden = scrollY < 360;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  new ResizeObserver(onScroll).observe(
    document.querySelector("#app") || document.body,
  );
  window.addEventListener("keydown", (event) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "k" &&
      !document.querySelector("dialog[open]")
    ) {
      event.preventDefault();
      ui.search();
    }
  });
  if (!preferences) showCookieBanner();
}

function setConsent(allowed) {
  preferences = savePreferences(storage("localStorage"), allowed);
  attribution = captureCampaign(
    location.search,
    allowed,
    storage("sessionStorage"),
  );
  document.querySelector("#cookie-banner").replaceChildren();
}

function showCookieBanner() {
  const { h, btn } = ui;
  document.querySelector("#cookie-banner").replaceChildren(
    h(
      "section",
      {
        class: "cookie-notice",
        "aria-label": "Cookie preferences",
      },
      h(
        "div",
        {},
        h("strong", {}, "Cookies & preferences"),
        h(
          "p",
          {},
          "Sign-in uses an essential cookie. Optional campaign tracking stays in this browser.",
        ),
      ),
      h(
        "div",
        { class: "cookie-actions" },
        btn(
          "Necessary only",
          () => setConsent(false),
          "button secondary compact",
        ),
        btn(
          "Allow campaign tracking",
          () => setConsent(true),
          "button primary compact",
        ),
      ),
    ),
  );
}

export function openPrivacy() {
  const { h, btn, modal, closeModal, toast } = ui;
  const attributionRows = attribution?.parameters
    ? Object.entries(attribution.parameters)
    : [];
  modal(
    "Cookies & preferences",
    h(
      "div",
      { class: "preferences-content" },
      h("h3", {}, "Essential sign-in cookie"),
      h(
        "p",
        {},
        "Keeps your session secure for up to eight hours. It is cleared when you sign out.",
      ),
      h("h3", {}, "Optional campaign tracking"),
      h(
        "p",
        {},
        "With your permission, UTM campaign parameters are kept in this tab until it closes. This app does not send campaign records to an analytics service or store them on its server. You can withdraw permission here.",
      ),
      h(
        "p",
        { class: "consent-state" },
        "Current setting: ",
        h(
          "strong",
          {},
          preferences?.campaignTracking
            ? "Campaign tracking allowed"
            : "Essential only",
        ),
      ),
      attributionRows.length
        ? h(
            "details",
            {},
            h("summary", {}, "View campaign details"),
            h(
              "dl",
              {},
              attributionRows.map(([key, value]) =>
                h("div", {}, h("dt", {}, key), h("dd", {}, value)),
              ),
            ),
          )
        : null,
      h(
        "div",
        { class: "form-actions" },
        btn("Necessary only", () => {
          setConsent(false);
          closeModal();
          toast("Cookie preferences saved.");
        }),
        btn(
          "Allow campaign tracking",
          () => {
            setConsent(true);
            closeModal();
            toast("Cookie preferences saved.");
          },
          "button primary",
        ),
      ),
    ),
  );
}

export function utilityControls() {
  const { h, btn } = ui;
  const dark = document.documentElement.dataset.theme === "dark";
  const theme = btn(
    dark ? "Light mode" : "Dark mode",
    () => {
      const next =
        document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem("pretalk.theme", next);
      } catch {
        /* The theme still works for this page. */
      }
      document.querySelectorAll(".theme-toggle").forEach((button) => {
        button.replaceChildren(
          ui.icon(next === "dark" ? "sun" : "moon"),
          document.createTextNode(next === "dark" ? "Light mode" : "Dark mode"),
        );
        button.setAttribute("aria-pressed", String(next === "dark"));
      });
    },
    "utility-button theme-toggle",
    dark ? "sun" : "moon",
  );
  theme.setAttribute("aria-pressed", String(dark));
  return h(
    "div",
    { class: "utility-controls" },
    btn("Search portal", ui.search, "utility-button search-toggle", "search"),
    theme,
  );
}

export function openContact() {
  const { h, btn, modal, closeModal } = ui;
  modal(
    "Contact & help",
    h(
      "div",
      { class: "contact-content" },
      h("h3", {}, "SRMIST information desk"),
      h(
        "a",
        {
          class: "contact-email email-link",
          href: "mailto:" + institutionEmail,
        },
        institutionEmail,
      ),
      h(
        "p",
        { class: "muted" },
        "For institutional enquiries. This portal is an independent demonstration.",
      ),
      h(
        "div",
        { class: "form-actions" },
        btn("Portal help", () => {
          closeModal();
          ui.help();
        }),
        h(
          "a",
          { class: "button primary", href: "mailto:" + institutionEmail },
          "Email information desk",
        ),
      ),
    ),
  );
}

export async function copyText(text, success = "Copied.") {
  try {
    if (!navigator.clipboard?.writeText)
      throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(text);
    ui.toast(success);
  } catch {
    const { h, modal, btn, closeModal } = ui;
    const field = h(
      "textarea",
      { id: "copy-text", readonly: true, rows: 9 },
      text,
    );
    modal(
      "Copy text",
      h(
        "div",
        {},
        h("p", { class: "muted" }, "Select and copy the text below."),
        h(
          "div",
          { class: "field" },
          h("label", { for: "copy-text" }, "Text to copy"),
          field,
        ),
        h("div", { class: "form-actions" }, btn("Close", closeModal)),
      ),
    );
    field.focus();
    field.select();
  }
}

export function printPage() {
  window.print();
}
