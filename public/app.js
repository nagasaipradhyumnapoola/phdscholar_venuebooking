import {
  institutionEmail,
  currentYear,
  pageDescriptions,
  setPageMetadata,
} from "./site.js";
import {
  initializeEnhancements,
  utilityControls,
  openPrivacy,
  copyText,
  printPage,
} from "./enhancements.js";
const $ = (s) => document.querySelector(s);
$(".skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  $("#main")?.focus();
});
const icons = {
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  calendar:
    "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  check: "m5 12 4 4L19 6",
  approval: "M9 3H5v18h14V3h-4m-6-1h6v4H9z m-1 9 3 3 5-6",
  people:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8m8 0a4 4 0 0 1 0 8",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  plus: "M12 5v14M5 12h14",
  logout: "M9 4H4v16h5m5-13 5 5-5 5M8 12h13",
  clock: "M12 8v5l3 2m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  mail: "M3 5h18v14H3zm0 0 9 8 9-8",
  book: "M3 4h6l3 3 3-3h6v16h-6l-3 2-3-2H3zm9 3v15",
  chevron: "m9 5 7 7-7 7",
  close: "m6 6 12 12M6 18 18 6",
  search: "m21 21-5-5m2-6a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  pin: "M12 22s7-8 7-13a7 7 0 1 0-14 0c0 5 7 13 7 13m3-13a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  shield: "m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6zm-4 10 3 3 5-6",
  history: "M3 3v6h6M3 9a9 9 0 1 1 0 6m9-8v5l4 2",
  menu: "M4 6h16M4 12h16M4 18h16",
  sun: "M12 3V1m0 22v-2M3 12H1m22 0h-2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2m-3 8a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
  moon: "M20 15a9 9 0 0 1-11-11 9 9 0 1 0 11 11Z",
  up: "m6 12 6-6 6 6M12 6v14",
  copy: "M8 8h13v13H8zM16 8V3H3v13h5",
  print: "M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v7H6zM17 11h1",
};
function icon(name) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("fill", "none");
  s.setAttribute("stroke", "currentColor");
  s.setAttribute("stroke-width", "1.6");
  s.setAttribute("stroke-linecap", "round");
  s.setAttribute("stroke-linejoin", "round");
  s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(s.namespaceURI, "path");
  p.setAttribute("d", icons[name] || icons.book);
  s.append(p);
  return s;
}
function h(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "class") e.className = v;
    else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c != null && c !== false)
      e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}
const btn = (label, fn, cls = "button secondary", ico) =>
  h(
    "button",
    {
      type: "button",
      class: cls,
      onClick: async (event) => {
        const button = event.currentTarget;
        try {
          const result = fn(event);
          if (result && typeof result.then === "function") {
            button.setAttribute("aria-busy", "true");
            button.classList.add("busy");
            button.disabled = true;
            await result;
          }
        } catch (error) {
          toast(error.message || "Please try again.", "error");
        } finally {
          if (button.classList.contains("busy")) {
            button.removeAttribute("aria-busy");
            button.classList.remove("busy");
            button.disabled = false;
          }
        }
      },
    },
    ico && icon(ico),
    label,
  );
const states = {
  pending_coordinator: ["Coordinator review", "amber"],
  pending_hod: ["HOD review", "blue"],
  approved: ["Confirmed", "green"],
  rejected: ["Rejected", "red"],
  cancelled: ["Cancelled", "gray"],
};
const roles = {
  admin: "Department admin",
  coordinator: "Research coordinator",
  supervisor: "Supervisor",
  hod: "Head of department",
  panel: "Panel member",
  scholar: "Research scholar",
};
let state = null,
  csrf = "",
  route = location.hash.slice(1) || "overview",
  month = new Date(),
  filter = "all",
  query = "",
  lastFocus,
  lastUpdatedAt = null,
  activeRequests = 0,
  navigationItems = [];
const dayFmt = (
  d,
  opts = { day: "numeric", month: "short", year: "numeric" },
) => new Date(d + "T12:00:00Z").toLocaleDateString("en-IN", opts);
const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const initials = (n) =>
  n
    .replace(/^Dr\.\s*/, "")
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
const badge = (status) =>
  h(
    "span",
    { class: `badge ${states[status]?.[1] || "gray"}` },
    h("span", { class: "status-dot" }),
    states[status]?.[0] || status,
  );
const manager = () => ["admin", "coordinator"].includes(state?.user.role);
function toast(message, kind = "success") {
  const t = $("#toast");
  t.textContent = message;
  t.dataset.kind = kind;
  t.setAttribute("role", kind === "error" ? "alert" : "status");
  t.classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("visible"), 5000);
}
async function api(path, method = "GET", body) {
  let r;
  activeRequests++;
  $("#request-progress")?.removeAttribute("hidden");
  try {
    r = await fetch("/api" + path, {
      method,
      signal: AbortSignal.timeout(20000),
      headers: {
        "Content-Type": "application/json",
        ...(csrf ? { "x-csrf-token": csrf } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error.name === "TimeoutError")
      throw new Error("The request timed out. Please try again.");
    throw new Error("Connection lost. Check your connection and try again.");
  } finally {
    activeRequests--;
    if (!activeRequests) $("#request-progress")?.setAttribute("hidden", "");
  }
  const d = await r.json();
  if (!r.ok) {
    if (r.status === 401 && path != "/login") {
      state = null;
      csrf = "";
      if ($("#dialog").open) closeModal();
      login();
    }
    const details = d.fields
      ?.map((f) => `${f.field}: ${f.message}`)
      .join(" · ");
    throw new Error(details || d.error || "Please try again.");
  }
  return d;
}
async function load() {
  state = await api("/bootstrap");
  lastUpdatedAt = new Date();
  render();
}
function navigate(next) {
  closeMobileMenu(false);
  route = next;
  location.hash = next;
  render();
  $("#main")?.focus();
}
window.addEventListener("hashchange", () => {
  const next = location.hash.slice(1) || "overview";
  if (next !== route) {
    route = next;
    if (state) render();
  }
});
let menuReturnFocus = true,
  menuTrigger;
function closeMobileMenu(restore = true) {
  const menu = $("#mobile-menu");
  if (!menu.open) return;
  menuReturnFocus = restore;
  menu.close();
}
$("#mobile-menu").addEventListener("close", () => {
  document.body.classList.remove("menu-open");
  $(".mobile-menu-toggle")?.setAttribute("aria-expanded", "false");
  if (menuReturnFocus && menuTrigger?.isConnected) menuTrigger.focus();
});
window.matchMedia("(max-width:960px)").addEventListener("change", (e) => {
  if (!e.matches) closeMobileMenu(false);
});
function openMobileMenu() {
  const menu = $("#mobile-menu");
  menuTrigger = document.activeElement;
  menuReturnFocus = true;
  const nav = $(".portal-header nav").cloneNode(true);
  nav.className = "mobile-navigation";
  nav.setAttribute("aria-label", "Mobile navigation");
  for (const link of nav.querySelectorAll("a"))
    link.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(link.hash.slice(1));
    });
  menu.replaceChildren(
    h(
      "div",
      { class: "menu-heading" },
      h("h2", { id: "mobile-menu-title" }, "Menu"),
      btn("Close menu", () => closeMobileMenu(), "icon-button", "close"),
    ),
    h(
      "div",
      { class: "menu-account" },
      h("strong", {}, state.user.name),
      h("span", {}, roles[state.user.role]),
    ),
    nav,
    h(
      "a",
      {
        href: "#guide",
        class: "menu-help",
        onClick: (e) => {
          e.preventDefault();
          navigate("guide");
        },
      },
      "Help & roles",
    ),
    btn(
      "Sign out",
      () => $(".portal-header .signout").click(),
      "button secondary menu-signout",
      "logout",
    ),
  );
  document.body.classList.add("menu-open");
  $(".mobile-menu-toggle").setAttribute("aria-expanded", "true");
  menu.showModal();
}
function emailLink(email) {
  return h("a", { href: "mailto:" + email, class: "email-link" }, email);
}
function footer(authenticated = !!state) {
  return h(
    "footer",
    { class: authenticated ? "page-footer" : "public-footer" },
    h(
      "div",
      {},
      h("span", {}, `© ${currentYear()} Research Office`),
      h("small", {}, "Independent demo · Not affiliated with SRMIST"),
      h(
        "small",
        { class: "last-updated" },
        authenticated && lastUpdatedAt ? "Data updated " : "Updated ",
        h(
          "time",
          {
            datetime:
              authenticated && lastUpdatedAt
                ? lastUpdatedAt.toISOString()
                : "2026-10-21",
          },
          authenticated && lastUpdatedAt
            ? lastUpdatedAt.toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                dateStyle: "medium",
                timeStyle: "short",
              }) + " IST"
            : "21 Oct 2026",
        ),
      ),
    ),
    h(
      "div",
      { class: "footer-links" },
      h(
        "a",
        {
          href: authenticated ? "#overview" : "/",
          onClick: authenticated
            ? (e) => {
                e.preventDefault();
                navigate("overview");
              }
            : null,
        },
        "Portal home",
      ),
      authenticated &&
        h(
          "a",
          {
            href: "#guide",
            onClick: (e) => {
              e.preventDefault();
              navigate("guide");
            },
          },
          "Help & roles",
        ),
      emailLink(institutionEmail),
      btn("Cookie preferences", openPrivacy, "footer-button"),
    ),
  );
}
function errorContent(code) {
  const title = code === 403 ? "Access denied" : "Page not found";
  return h(
    "section",
    { class: "not-found" },
    h("p", { class: "error-code" }, code),
    h("h1", {}, title),
    h(
      "p",
      {},
      code === 403
        ? "Your account does not have access to this page."
        : "This address does not match a page in the portal.",
    ),
    btn(
      "Return to overview",
      () => navigate("overview"),
      "button primary",
      "arrow",
    ),
  );
}
function field(label, name, type = "text", extra = {}) {
  const input = h("input", { id: "f-" + name, name, type, ...extra });
  return h(
    "label",
    { class: "field", for: "f-" + name },
    h("span", {}, label),
    input,
  );
}
function select(label, name, options) {
  return h(
    "div",
    { class: "field" },
    h("label", { for: "f-" + name }, label),
    h(
      "select",
      { id: "f-" + name, name, required: true },
      options.map((o) =>
        h(
          "option",
          { value: o.value, disabled: o.disabled, selected: o.selected },
          o.label,
        ),
      ),
    ),
  );
}
function textArea(label, name, extra = {}) {
  return h(
    "label",
    { class: "field", for: "f-" + name },
    h("span", {}, label),
    h("textarea", { id: "f-" + name, name, rows: 3, ...extra }),
  );
}
function empty(title, body) {
  return h(
    "div",
    { class: "empty" },
    icon("book"),
    h("h3", {}, title),
    h("p", {}, body),
  );
}
function formError(form, error) {
  let box = form.querySelector(".form-error");
  if (!box) {
    box = h("div", { class: "form-error", role: "alert", tabindex: "-1" });
    form.prepend(box);
  }
  box.textContent = error.message;
  box.focus();
}
function submitForm(form, handler) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submit = form.querySelector("[type=submit]");
    submit.disabled = true;
    submit.setAttribute("aria-busy", "true");
    submit.classList.add("busy");
    try {
      await handler(new FormData(form));
    } catch (e) {
      formError(form, e);
    } finally {
      submit.disabled = false;
      submit.removeAttribute("aria-busy");
      submit.classList.remove("busy");
    }
  });
  return form;
}
function modal(title, content, cls = "") {
  lastFocus = document.activeElement;
  const d = $("#dialog");
  d.replaceChildren(
    h(
      "div",
      { class: "dialog-head" },
      h(
        "div",
        {},
        h("p", { class: "eyebrow" }, "RESEARCH OFFICE"),
        h("h2", { id: "dialog-title" }, title),
      ),
      btn("Close", () => d.close(), "icon-button close-label", "close"),
    ),
    content,
  );
  d.className = cls;
  if (!d.open) d.showModal();
}
$("#dialog").addEventListener("close", () => {
  if (lastFocus?.isConnected) lastFocus.focus();
  else $("#main")?.focus();
});
function closeModal() {
  $("#dialog").close();
}

async function signOut() {
  await api("/logout", "POST", {});
  state = null;
  csrf = "";
  navigationItems = [];
  login();
  toast("Signed out.");
}

function portalHeader(nav = [], pending = 0, unread = 0) {
  const authenticated = !!state;
  return h(
    "header",
    { class: "portal-header" },
    h(
      "div",
      { class: "utility-bar" },
      h(
        "div",
        { class: "header-width utility-inner" },
        h("span", { class: "demo-label" }, "Independent demo"),
        authenticated &&
          h(
            "span",
            { class: "account-label" },
            state.user.name,
            h("span", {}, roles[state.user.role]),
          ),
        utilityControls(),
        authenticated &&
          btn("Sign out", signOut, "utility-button signout", "logout"),
      ),
    ),
    h(
      "div",
      { class: "masthead header-width" },
      h(
        "a",
        {
          class: "brand",
          href: authenticated ? "#overview" : "/",
          onClick: authenticated
            ? (e) => {
                e.preventDefault();
                navigate("overview");
              }
            : null,
        },
        h("img", {
          class: "srm-logo",
          src: "/assets/srm-logo-white.svg",
          alt: "SRM Institute of Science and Technology",
          width: 600,
          height: 203,
        }),
      ),
      h(
        "div",
        { class: "portal-identity" },
        h("strong", {}, "Ph.D. Pre-talk Portal"),
        h(
          "span",
          {},
          authenticated
            ? "Department of " + state.department.name
            : "Scheduling & approval",
        ),
      ),
      authenticated &&
        h(
          "button",
          {
            type: "button",
            class: "mobile-menu-toggle",
            "aria-label": "Open menu",
            "aria-controls": "mobile-menu",
            "aria-expanded": "false",
            onClick: openMobileMenu,
          },
          icon("menu"),
          h("span", {}, "Menu"),
        ),
    ),
    authenticated &&
      h(
        "div",
        { class: "navigation-bar" },
        h(
          "nav",
          { class: "header-width", "aria-label": "Main navigation" },
          nav.map(([key, label, ico]) =>
            h(
              "a",
              {
                href: "#" + key,
                class: `nav-item ${route === key ? "active" : ""}`,
                "aria-current": route === key ? "page" : null,
                onClick: (e) => {
                  e.preventDefault();
                  navigate(key);
                },
              },
              icon(ico),
              h("span", {}, label),
              key === "approvals" && pending
                ? h("span", { class: "nav-count" }, pending)
                : null,
              key === "notifications" && unread
                ? h("span", { class: "nav-count" }, unread)
                : null,
            ),
          ),
        ),
      ),
  );
}

function faqSection(compact = false) {
  const questions = [
    [
      "Who submits a pre-talk request?",
      "The mapped supervisor submits the request. The coordinator maintains scholar mappings and enables future dates.",
    ],
    [
      "When is a date reserved?",
      "Submission reserves the whole department’s day, across every venue. A second active request cannot use that day.",
    ],
    [
      "When are participants notified?",
      "Notifications and email records are created after final HOD approval, following coordinator approval.",
    ],
    [
      "Can a request be changed or cancelled?",
      "Assumption: submitted details cannot be edited. Withdraw or cancel with a reason, then submit again. Supervisors can withdraw pending requests; the coordinator or admin can cancel confirmed future talks.",
    ],
    [
      "Why can’t I see another scholar’s request?",
      "Access follows your role, department, supervisor mapping, and panel assignment. Scholars and panel members have read-only access to their own or assigned records.",
    ],
    [
      "Are these official SRM accounts?",
      "These are fictional demonstration accounts. Do not enter real SRM credentials. This portal is independently built and is not affiliated with SRMIST.",
    ],
  ];
  return h(
    "section",
    {
      class: compact
        ? "faq-section compact-faq"
        : "panel guide-panel faq-section",
      id: compact ? "login-faq" : "portal-faq",
    },
    h("h2", {}, "Frequently asked questions"),
    questions
      .filter((_, i) => !compact || i === 0 || i === 5)
      .map(([question, answer]) =>
        h("details", {}, h("summary", {}, question), h("p", {}, answer)),
      ),
  );
}

function searchPortal() {
  const results = h("div", {
    class: "search-results",
    id: "portal-search-results",
    "aria-live": "polite",
  });
  const input = h("input", {
    id: "portal-search",
    type: "search",
    autocomplete: "off",
    "aria-controls": "portal-search-results",
  });
  const go = (key) => {
    closeModal();
    navigate(key);
  };
  const match = (value, term) => value.toLocaleLowerCase().includes(term);
  const update = () => {
    const term = input.value.trim().toLocaleLowerCase().slice(0, 160);
    const links = state
      ? [...navigationItems, ["guide", "Help & roles", "book"]]
      : [
          ["login", "Sign in", "shield"],
          ["faq", "Frequently asked questions", "book"],
        ];
    const pages = links.filter(([, label]) => !term || match(label, term));
    const bookings =
      state && term
        ? state.bookings
            .filter((b) =>
              match(
                [
                  b.scholar_name,
                  b.registration_id,
                  b.title,
                  b.venue,
                  b.date,
                  states[b.status]?.[0],
                ].join(" "),
                term,
              ),
            )
            .slice(0, 12)
        : [];
    const scholars =
      state && term && links.some(([key]) => key === "scholars")
        ? state.scholars
            .filter((s) =>
              match(
                [s.name, s.registration_id, s.supervisor_name].join(" "),
                term,
              ),
            )
            .slice(0, 6)
        : [];
    results.replaceChildren(
      ...[
        pages.length
          ? h(
              "section",
              {},
              h("h3", {}, "Pages"),
              pages.map(([key, label, ico]) =>
                btn(
                  label,
                  () => {
                    if (state) go(key);
                    else {
                      closeModal();
                      key === "faq"
                        ? $("#login-faq")?.scrollIntoView({ block: "center" })
                        : $("#f-email")?.focus();
                    }
                  },
                  "search-result",
                  ico,
                ),
              ),
            )
          : null,
        bookings.length
          ? h(
              "section",
              {},
              h("h3", {}, "Pre-talks"),
              bookings.map((b) =>
                h(
                  "button",
                  {
                    type: "button",
                    class: "search-result",
                    onClick: () => {
                      closeModal();
                      detail(b.id);
                    },
                  },
                  icon("book"),
                  h(
                    "span",
                    {},
                    h("strong", {}, b.scholar_name + " · " + b.registration_id),
                    h("small", {}, b.title + " · " + dayFmt(b.date)),
                  ),
                ),
              ),
            )
          : null,
        scholars.length
          ? h(
              "section",
              {},
              h("h3", {}, "Scholars"),
              scholars.map((s) =>
                btn(
                  s.name + " · " + s.registration_id,
                  () => go("scholars"),
                  "search-result",
                  "people",
                ),
              ),
            )
          : null,
        !pages.length && !bookings.length && !scholars.length
          ? empty(
              "No matching results",
              "Try a scholar name, registration ID, research title, or page name.",
            )
          : null,
        state && term && (bookings.length || scholars.length)
          ? h(
              "p",
              { class: "small muted search-note" },
              "Showing records available to your account.",
            )
          : null,
      ].filter(Boolean),
    );
  };
  input.addEventListener("input", update);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeModal();
    }
  });
  update();
  modal(
    "Search portal",
    h(
      "div",
      { class: "portal-search-content" },
      h(
        "label",
        { class: "field", for: "portal-search" },
        "Search portal",
        input,
      ),
      results,
    ),
  );
  input.focus();
}

function login() {
  closeMobileMenu(false);
  setPageMetadata("Sign in", "login");
  const emailField = field("Email address", "email", "email", {
    required: true,
    autocomplete: "username",
  });
  const passwordField = field("Password", "password", "password", {
    required: true,
    autocomplete: "current-password",
  });
  const form = h(
    "form",
    { class: "login-form" },
    h("p", { class: "eyebrow" }, "PHD PRE-TALK PORTAL"),
    h("h1", {}, "Sign in"),
    h(
      "p",
      { class: "muted login-intro" },
      "Use your department email and password.",
    ),
    emailField,
    passwordField,
    h(
      "label",
      { class: "check-label" },
      h("input", {
        type: "checkbox",
        onChange: (e) =>
          (passwordField.querySelector("input").type = e.target.checked
            ? "text"
            : "password"),
      }),
      "Show password",
    ),
    h(
      "button",
      { type: "submit", class: "button primary login-submit" },
      "Sign in to workspace",
      icon("arrow"),
    ),
  );
  submitForm(form, async (data) => {
    const r = await api("/login", "POST", Object.fromEntries(data));
    csrf = r.csrf;
    route = "overview";
    filter = "all";
    query = "";
    location.hash = route;
    await load();
    toast("Signed in.");
  });
  const demos = h(
    "div",
    { class: "demo-access" },
    h(
      "div",
      { class: "section-label" },
      h("span", {}, "DEMO ACCOUNTS"),
      h("span", { class: "small muted" }, "Fictional accounts only"),
    ),
    h(
      "div",
      { class: "demo-roles" },
      ["coordinator", "supervisor", "hod", "panel", "admin", "scholar"].map(
        (r) =>
          btn(
            roles[r],
            () => {
              emailField.querySelector("input").value = `${r}@demo.example`;
              passwordField.querySelector("input").value = "DemoOnly!2026";
              form.querySelector("[type=submit]").focus();
            },
            "demo-role",
          ),
      ),
    ),
    h(
      "p",
      { class: "small muted" },
      "Choose a role to fill the demo credentials. Password: ",
      h("code", {}, "DemoOnly!2026"),
      btn(
        "Copy demo password",
        () => copyText("DemoOnly!2026", "Demo password copied."),
        "text-button copy-demo",
        "copy",
      ),
    ),
  );
  $("#app").replaceChildren(
    h(
      "div",
      { class: "public-layout" },
      portalHeader(),
      h(
        "main",
        { id: "main", class: "login-main", tabindex: "-1" },
        h(
          "section",
          { class: "login-information" },
          h("p", { class: "eyebrow" }, "DOCTORAL RESEARCH"),
          h("h2", {}, "Ph.D. Pre-talk Scheduling"),
          h(
            "p",
            { class: "login-description" },
            "Department scheduling and approval for research scholars.",
          ),
          h(
            "ol",
            { class: "login-process" },
            h(
              "li",
              {},
              h("strong", {}, "Submit a request"),
              h(
                "p",
                {},
                "The supervisor selects an enabled date, venue, time, and panel.",
              ),
            ),
            h(
              "li",
              {},
              h("strong", {}, "Complete the review"),
              h("p", {}, "Coordinator review is followed by HOD approval."),
            ),
            h(
              "li",
              {},
              h("strong", {}, "Receive confirmation"),
              h(
                "p",
                {},
                "The scholar, supervisor, and panel are notified after final approval.",
              ),
            ),
          ),
          h(
            "div",
            { class: "login-rule" },
            icon("calendar"),
            "One pre-talk per department per day.",
          ),
          faqSection(true),
        ),
        h(
          "div",
          { class: "login-content" },
          form,
          demos,
          h(
            "p",
            { class: "login-note" },
            "Use demo credentials only. Never enter a real SRM password.",
          ),
        ),
      ),
      footer(false),
    ),
  );
}

function render() {
  if (!state) return;
  const u = state.user,
    unread = state.notifications.filter((n) => !n.read_at).length;
  const pending = state.bookings.filter((b) =>
    u.role === "hod"
      ? b.status === "pending_hod"
      : b.status === "pending_coordinator",
  ).length;
  const nav = [
    ["overview", "Overview", "overview"],
    ["calendar", manager() ? "Manage dates" : "Available dates", "calendar"],
    [
      "requests",
      u.role === "supervisor" ? "My pre-talks" : "All pre-talks",
      "book",
    ],
    ...(["admin", "coordinator", "hod"].includes(u.role)
      ? [["approvals", "Approval queue", "approval"]]
      : []),
    ...(["admin", "coordinator", "supervisor", "hod", "scholar"].includes(
      u.role,
    )
      ? [["scholars", "Scholars & mapping", "people"]]
      : []),
    ...(manager() ? [["people", "Faculty & access", "shield"]] : []),
    ["notifications", "Notifications", "bell"],
    ["outbox", "Email outbox", "mail"],
    ...(manager() ? [["audit", "Activity log", "history"]] : []),
  ];
  const routeEntry =
    nav.find((n) => n[0] === route) ||
    (route === "guide" ? ["guide", "Help & roles"] : null);
  const routeError = routeEntry ? null : pageDescriptions[route] ? 403 : 404;
  const title =
    routeEntry?.[1] ||
    (routeError === 403 ? "Access denied" : "Page not found");
  setPageMetadata(
    title,
    routeError === 403 ? "forbidden" : routeError ? "notFound" : route,
  );
  navigationItems = nav;
  const header = portalHeader(nav, pending, unread);
  const main = h(
    "main",
    { id: "main", tabindex: "-1", class: "workspace" },
    h("div", { class: "content", id: "page" }),
  );
  $("#app").replaceChildren(
    h(
      "div",
      { class: "app-layout" },
      header,
      h(
        "div",
        { class: "context-bar" },
        h(
          "div",
          { class: "breadcrumb" },
          "Doctoral research",
          icon("chevron"),
          h("strong", {}, title),
        ),
        h("span", { class: "timezone" }, "All schedules in IST"),
      ),
      main,
      footer(),
    ),
  );
  const pages = {
    overview: overviewPage,
    calendar: calendarPage,
    requests: requestsPage,
    approvals: approvalsPage,
    scholars: scholarsPage,
    people: peoplePage,
    notifications: notificationsPage,
    outbox: outboxPage,
    audit: auditPage,
    guide: guidePage,
  };
  if (routeError) setPage(errorContent(routeError));
  else pages[route]();
}
function pageHeader(eyebrow, title, desc, action) {
  return h(
    "div",
    { class: "page-heading" },
    h(
      "div",
      {},
      h("p", { class: "eyebrow" }, eyebrow),
      h("h1", {}, title),
      h("p", { class: "muted" }, desc),
    ),
    action,
  );
}
function setPage(...children) {
  $("#page").replaceChildren(...children);
}
function bookingButton() {
  return state.user.role === "supervisor"
    ? btn("Schedule a pre-talk", bookingModal, "button primary", "plus")
    : manager()
      ? btn(
          "Manage available dates",
          () => navigate("calendar"),
          "button primary",
          "calendar",
        )
      : null;
}
function overviewPage() {
  const b = state.bookings,
    waiting = b.filter(
      (b) => b.status === "pending_coordinator" || b.status === "pending_hod",
    ),
    confirmed = b.filter(
      (b) => b.status === "approved" && b.date >= state.today,
    ),
    available = state.dates.filter(
      (d) => d.enabled && !d.reserved && d.date > state.today,
    );
  const relevant =
    state.user.role === "hod"
      ? waiting.filter((b) => b.status === "pending_hod")
      : manager()
        ? waiting.filter((b) => b.status === "pending_coordinator")
        : waiting;
  setPage(
    pageHeader(
      "DEPARTMENT OF " + state.department.name.toUpperCase(),
      "Pre-talk overview",
      "Requests, approvals, and upcoming schedules.",
      bookingButton(),
    ),
    h(
      "div",
      { class: "overview-strip" },
      h(
        "span",
        { class: "strip-label" },
        icon("calendar"),
        "DEPARTMENT SCHEDULE",
      ),
      h("span", {}, "One pre-talk per day"),
      h("span", { class: "strip-dot" }, "·"),
      h(
        "span",
        { class: "muted" },
        "Reserved from submission through final approval",
      ),
      btn("View calendar", () => navigate("calendar"), "text-button", "arrow"),
    ),
    h(
      "section",
      { class: "metrics", "aria-label": "Schedule summary" },
      metric(
        "Awaiting approval",
        waiting.length,
        "Coordinator or HOD review",
        "approval",
        "amber",
      ),
      metric(
        "Confirmed pre-talks",
        confirmed.length,
        "Upcoming approved talks",
        "check",
        "green",
      ),
      metric(
        "Open dates",
        available.length,
        "Enabled by your coordinator",
        "calendar",
        "blue",
      ),
    ),
    h(
      "div",
      { class: "dashboard-grid" },
      h(
        "section",
        { class: "panel" },
        h(
          "div",
          { class: "panel-heading" },
          h(
            "div",
            {},
            h("p", { class: "eyebrow" }, "PENDING REQUESTS"),
            h(
              "h2",
              {},
              ["panel", "scholar"].includes(state.user.role)
                ? "Your pre-talks"
                : "Needs attention",
            ),
          ),
          btn("View all", () => navigate("requests"), "text-button", "arrow"),
        ),
        relevant.length
          ? bookingList(relevant.slice(0, 4))
          : empty(
              "No pending requests",
              "There are no requests waiting at this stage.",
            ),
        h(
          "div",
          { class: "panel-footer" },
          icon("shield"),
          "Coordinator review comes before HOD approval.",
        ),
      ),
      h(
        "section",
        { class: "panel upcoming" },
        h(
          "div",
          { class: "panel-heading" },
          h(
            "div",
            {},
            h("p", { class: "eyebrow" }, "UPCOMING"),
            h("h2", {}, "Confirmed schedule"),
          ),
          icon("calendar"),
        ),
        confirmed.length
          ? h(
              "div",
              { class: "upcoming-list" },
              confirmed
                .slice(0, 3)
                .map((t) =>
                  h(
                    "button",
                    { class: "upcoming-item", onClick: () => detail(t.id) },
                    h(
                      "div",
                      { class: "date-tile" },
                      h("strong", {}, dayFmt(t.date, { day: "2-digit" })),
                      h("span", {}, dayFmt(t.date, { month: "short" })),
                    ),
                    h(
                      "div",
                      {},
                      h("strong", {}, t.scholar_name),
                      h("p", {}, t.time + " IST"),
                      h("span", { class: "small muted" }, t.venue),
                    ),
                    icon("chevron"),
                  ),
                ),
            )
          : empty(
              "No confirmed pre-talks",
              "Confirmed pre-talks will appear here.",
            ),
        h(
          "div",
          { class: "panel-footer" },
          btn(
            "Explore available dates",
            () => navigate("calendar"),
            "text-button",
            "arrow",
          ),
        ),
      ),
    ),
  );
}
function metric(label, value, caption, ico, color) {
  return h(
    "div",
    { class: "metric" },
    h(
      "div",
      {},
      h("span", { class: "metric-label" }, label),
      h("strong", { class: "metric-value" }, String(value)),
      h("p", {}, caption),
    ),
  );
}
function bookingList(items) {
  return h(
    "div",
    { class: "booking-list" },
    items.map((b) =>
      h(
        "button",
        { class: "booking-row", onClick: () => detail(b.id) },
        h(
          "div",
          { class: "scholar-cell" },
          h(
            "div",
            {},
            h("strong", {}, b.scholar_name),
            h("span", { class: "small muted" }, b.registration_id),
          ),
        ),
        h(
          "div",
          { class: "booking-subject" },
          h("strong", {}, b.title),
          h(
            "span",
            { class: "small muted" },
            dayFmt(b.date) + " · " + b.time + " IST",
          ),
        ),
        badge(b.status),
        icon("chevron"),
      ),
    ),
  );
}
function requestsPage() {
  const toolbar = h(
    "div",
    { class: "table-toolbar" },
    h(
      "div",
      { class: "tabs", "aria-label": "Status filters" },
      [
        ["all", "All requests"],
        ["pending", "In review"],
        ["approved", "Confirmed"],
        ["closed", "Closed"],
      ].map(([v, t]) =>
        btn(
          t,
          () => {
            filter = v;
            requestsPage();
          },
          `tab ${filter === v ? "selected" : ""}`,
        ),
      ),
    ),
    h(
      "label",
      { class: "search-field" },
      icon("search"),
      h("span", {}, "Search pre-talks"),
      h("input", {
        type: "search",
        value: query,
        onInput: (e) => {
          query = e.target.value;
          updateRows();
        },
      }),
    ),
  );
  setPage(
    pageHeader(
      "REQUEST REGISTER",
      state.user.role === "supervisor"
        ? "My pre-talks"
        : "Department pre-talks",
      "Track requests, decisions, and the full history of each pre-talk.",
      bookingButton(),
    ),
    h("section", { class: "panel" }, toolbar, h("div", { id: "request-rows" })),
  );
  updateRows();
}
function updateRows() {
  const items = state.bookings.filter(
    (b) =>
      (filter === "all" ||
        (filter === "pending" && b.status.startsWith("pending")) ||
        (filter === "approved" && b.status === "approved") ||
        (filter === "closed" &&
          ["rejected", "cancelled"].includes(b.status))) &&
      `${b.scholar_name} ${b.title} ${b.registration_id}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  $("#request-rows").replaceChildren(
    items.length
      ? bookingList(items)
      : empty("No pre-talks found", "Try a different filter or search."),
  );
}
function approvalsPage() {
  const stage =
      state.user.role === "hod" ? "pending_hod" : "pending_coordinator",
    items = state.bookings.filter((b) => b.status === stage);
  setPage(
    pageHeader(
      "REVIEW & DECIDE",
      "Approval queue",
      state.user.role === "hod"
        ? "These requests have completed coordinator review and await your final decision."
        : "Verify the scholar, panel, venue, and schedule before forwarding to the HOD.",
    ),
    h(
      "div",
      { class: "info-banner" },
      icon("shield"),
      `${items.length} request${items.length === 1 ? "" : "s"} ready for your review. Final approval sends confirmation to the supervisor, scholar, panel, and HOD.`,
    ),
    h(
      "section",
      { class: "panel" },
      items.length
        ? bookingList(items)
        : empty(
            "Your queue is clear",
            "New requests will appear here when they reach your review stage.",
          ),
    ),
  );
}
function calendarPage() {
  const year = month.getFullYear(),
    m = month.getMonth(),
    first = new Date(year, m, 1),
    offset = (first.getDay() + 6) % 7,
    days = new Date(year, m + 1, 0).getDate(),
    map = new Map(state.dates.map((d) => [d.date, d]));
  const grid = h(
    "div",
    { class: "calendar-grid" },
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) =>
      h("div", { class: "weekday" }, d),
    ),
  );
  for (let i = 0; i < offset; i++)
    grid.append(h("div", { class: "calendar-blank" }));
  for (let n = 1; n <= days; n++) {
    const day = dateKey(new Date(year, m, n)),
      entry = map.get(day),
      past = day <= state.today,
      type = entry?.reserved
        ? "reserved"
        : entry?.enabled
          ? "available"
          : "unavailable",
      label = past
        ? "Past / today"
        : entry?.reserved
          ? "Reserved"
          : entry?.enabled
            ? "Available"
            : "Not enabled";
    const dayButton = h(
      "button",
      {
        class: `calendar-day ${type} ${day === state.today ? "today" : ""}`,
        "aria-label": `${dayFmt(day)}: ${label}`,
        disabled:
          past ||
          (!manager() &&
            (state.user.role !== "supervisor" ||
              !entry?.enabled ||
              entry.reserved)),
        onClick: () => (manager() ? dateModal(day, entry) : bookingModal(day)),
      },
      h("span", {}, n),
      h("small", {}, label),
      entry?.reserved && h("span", { class: "day-indicator" }, icon("book")),
    );
    grid.append(dayButton);
  }
  setPage(
    pageHeader(
      "DATE AVAILABILITY",
      manager() ? "Manage dates" : "Available dates",
      manager()
        ? "Enable future days for your department. An active reservation always protects the whole day."
        : state.user.role === "supervisor"
          ? "Choose a date, then enter the venue and time."
          : "Department date availability. Booking is limited to supervisors.",
      state.user.role === "supervisor" ? bookingButton() : null,
    ),
    h(
      "section",
      { class: "panel calendar-panel" },
      h(
        "div",
        { class: "calendar-heading" },
        h(
          "h2",
          {},
          month.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
        ),
        h(
          "div",
          { class: "month-controls" },
          btn(
            "Previous month",
            () => {
              month = new Date(year, m - 1, 1);
              calendarPage();
            },
            "icon-button previous",
            "chevron",
          ),
          btn(
            "This month",
            () => {
              month = new Date();
              calendarPage();
            },
            "button secondary compact",
          ),
          btn(
            "Next month",
            () => {
              month = new Date(year, m + 1, 1);
              calendarPage();
            },
            "icon-button",
            "chevron",
          ),
        ),
      ),
      grid,
      h(
        "div",
        { class: "calendar-legend" },
        h("span", {}, h("i", { class: "legend available" }), "Available"),
        h(
          "span",
          {},
          h("i", { class: "legend reserved" }),
          "Reserved · all venues",
        ),
        h("span", {}, h("i", { class: "legend unavailable" }), "Not enabled"),
        h("span", { class: "muted" }, "All dates and times are in IST."),
      ),
    ),
    h(
      "div",
      { class: "info-banner" },
      icon("calendar"),
      manager()
        ? "Select any future day to enable or disable it. Cancel active requests before disabling their day."
        : "Only the coordinator can open dates. A reserved day becomes available again when a request is rejected or cancelled.",
    ),
  );
}
function dateModal(day, entry) {
  const f = h(
    "form",
    {},
    h(
      "p",
      { class: "muted" },
      dayFmt(day, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    ),
    entry?.reserved
      ? h(
          "div",
          { class: "info-banner" },
          "This day is reserved. Cancel its pre-talk before disabling it.",
        )
      : null,
    select("Booking availability", "enabled", [
      { value: "true", label: "Open for booking", selected: entry?.enabled },
      { value: "false", label: "Not available", selected: !entry?.enabled },
    ]),
    field("Coordinator note (optional)", "note", "text", {
      value: entry?.note || "",
      maxlength: 200,
    }),
    h(
      "div",
      { class: "form-actions" },
      btn("Back", closeModal),
      h("button", { type: "submit", class: "button primary" }, "Save date"),
    ),
  );
  submitForm(f, async (data) => {
    await api("/dates/" + day, "PUT", {
      enabled: data.get("enabled") === "true",
      note: data.get("note"),
    });
    closeModal();
    await load();
    toast("Department date updated.");
  });
  modal("Manage " + dayFmt(day), f);
}
function bookingModal(selected = "") {
  if (typeof selected !== "string") selected = "";
  const available = state.dates.filter(
      (d) => d.enabled && !d.reserved && d.date > state.today,
    ),
    activeScholarIds = new Set(
      state.bookings
        .filter((b) =>
          ["pending_coordinator", "pending_hod", "approved"].includes(b.status),
        )
        .map((b) => b.scholar_id),
    ),
    scholars = state.scholars.filter(
      (s) => s.supervisor_id === state.user.id && !activeScholarIds.has(s.id),
    ),
    panels = state.faculty.filter((f) => f.role === "panel" && f.active);
  if (!scholars.length || !available.length) {
    modal(
      "Schedule a pre-talk",
      empty(
        !scholars.length ? "No eligible scholars" : "No open dates",
        !scholars.length
          ? "All your mapped scholars have an active pre-talk, or no scholars are mapped to you. Ask the coordinator for help."
          : "Ask the coordinator to enable a future date.",
      ),
    );
    return;
  }
  const f = h(
    "form",
    {},
    h(
      "div",
      { class: "info-banner" },
      icon("calendar"),
      "Your submission reserves the entire department’s day immediately.",
    ),
    h(
      "div",
      { class: "form-grid" },
      select(
        "Research scholar",
        "scholar_id",
        scholars.map((s) => ({
          value: s.id,
          label: s.name + " · " + s.registration_id,
        })),
      ),
      select(
        "Pre-talk date · IST",
        "date",
        available.map((d) => ({
          value: d.date,
          label: dayFmt(d.date, {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          selected: d.date === selected,
        })),
      ),
      field("Start time · IST", "time", "time", {
        value: "10:00",
        required: true,
      }),
      field("Venue · enter manually", "venue", "text", {
        required: true,
        minlength: 3,
        maxlength: 160,
      }),
    ),
    field("Research title", "title", "text", {
      required: true,
      minlength: 10,
      maxlength: 240,
    }),
    textArea("Research summary (optional)", "abstract", { maxlength: 3000 }),
    h(
      "fieldset",
      { class: "panel-selection" },
      h("legend", {}, "Panel members"),
      h(
        "p",
        { class: "small muted" },
        "Select the reviewers for this pre-talk. At least one is required; four or five is recommended.",
      ),
      panels.map((p) =>
        h(
          "label",
          { class: "check-label" },
          h("input", {
            type: "checkbox",
            name: "panel_ids",
            value: p.id,
            checked: true,
          }),
          p.name,
        ),
      ),
    ),
    h(
      "div",
      { class: "form-actions" },
      btn("Cancel", closeModal),
      h(
        "button",
        { type: "submit", class: "button primary" },
        "Submit for coordinator review",
        icon("arrow"),
      ),
    ),
  );
  submitForm(f, async (data) => {
    const payload = Object.fromEntries(data);
    payload.panel_ids = data.getAll("panel_ids");
    await api("/bookings", "POST", payload);
    closeModal();
    await load();
    toast("Day reserved. Your request is awaiting coordinator review.");
  });
  modal("Schedule a pre-talk", f, "wide");
}

async function detail(id) {
  try {
    const b = await api("/bookings/" + id),
      u = state.user,
      review =
        (manager() && b.status === "pending_coordinator") ||
        (u.role === "hod" && b.status === "pending_hod"),
      canCancel =
        ["pending_coordinator", "pending_hod", "approved"].includes(b.status) &&
        (manager() ||
          (u.role === "supervisor" &&
            b.supervisor_id === u.id &&
            b.status !== "approved"));
    const details = h(
      "div",
      { class: "detail-content" },
      h(
        "div",
        { class: "detail-tools" },
        badge(b.status),
        h(
          "div",
          { class: "detail-tool-buttons" },
          btn(
            "Copy schedule",
            () =>
              copyText(
                [
                  b.title,
                  `${b.scholar_name} · ${b.registration_id}`,
                  `Supervisor: ${b.supervisor_name}`,
                  `${dayFmt(b.date)} · ${b.time} IST`,
                  `Venue: ${b.venue}`,
                  `Status: ${states[b.status]?.[0] || b.status}`,
                  `Panel: ${b.panel.map((p) => p.name).join(", ")}`,
                ].join("\n"),
                "Schedule copied.",
              ),
            "button secondary compact",
            "copy",
          ),
          btn("Print pre-talk", printPage, "button secondary compact", "print"),
        ),
      ),
      h(
        "p",
        { class: "print-only print-label" },
        "Ph.D. Pre-talk Scheduling · Independent demo",
      ),
      h("h3", { class: "research-title" }, b.title),
      h(
        "div",
        { class: "detail-grid" },
        [
          ["Research scholar", b.scholar_name],
          ["Registration ID", b.registration_id],
          ["Supervisor", b.supervisor_name],
          [
            "Date",
            dayFmt(b.date, {
              weekday: "short",
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
          ],
          ["Start time", b.time + " IST"],
          ["Venue", b.venue],
        ].map(([k, v]) =>
          h(
            "div",
            {},
            h("span", { class: "small muted" }, k),
            h("strong", {}, v),
          ),
        ),
      ),
      b.abstract &&
        h(
          "div",
          { class: "detail-section" },
          h("h3", {}, "Research summary"),
          h("p", {}, b.abstract),
        ),
      h(
        "div",
        { class: "detail-section" },
        h("h3", {}, "Review panel"),
        h(
          "div",
          { class: "panel-members" },
          b.panel.map((p) =>
            h("span", { class: "person-chip" }, icon("people"), p.name),
          ),
        ),
      ),
      h(
        "div",
        { class: "detail-section" },
        h("h3", {}, "Request history"),
        h(
          "ol",
          { class: "timeline" },
          b.history.map((t) =>
            h(
              "li",
              {},
              h("div", { class: "timeline-dot" }),
              h(
                "div",
                {},
                h(
                  "strong",
                  {},
                  t.action === "submitted"
                    ? "Submitted by supervisor"
                    : states[t.action]?.[0] || t.action,
                ),
                h("p", {}, t.note || "Decision recorded."),
                h(
                  "small",
                  { class: "muted" },
                  `${t.actor_name} · ${new Date(t.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST`,
                ),
              ),
            ),
          ),
        ),
      ),
      review || canCancel ? actionForm(b, review, canCancel) : null,
    );
    modal("Pre-talk details", details, "wide");
  } catch (e) {
    toast(e.message, "error");
  }
}
function actionForm(b, review, canCancel) {
  const f = h(
    "form",
    { class: "decision-form" },
    h("h3", {}, review ? "Record your decision" : "Withdraw this request"),
    textArea("Review note · required for rejection or cancellation", "note", {
      maxlength: 1500,
    }),
    h(
      "div",
      { class: "decision-options" },
      select("Action", "action", [
        ...(review
          ? [
              {
                value: "approve",
                label:
                  b.status === "pending_hod"
                    ? "Give final approval & notify"
                    : "Approve & forward to HOD",
              },
              { value: "reject", label: "Reject request & release day" },
            ]
          : []),
        ...(canCancel
          ? [{ value: "cancel", label: "Cancel request & release day" }]
          : []),
      ]),
      h(
        "button",
        { type: "submit", class: "button primary" },
        "Continue",
        icon("arrow"),
      ),
    ),
  );
  submitForm(f, async (data) => {
    const payload = { ...Object.fromEntries(data), version: b.version };
    if (
      ["reject", "cancel"].includes(payload.action) &&
      payload.note.trim().length < 5
    )
      throw new Error("Provide a reason of at least 5 characters.");
    const confirmation = h(
      "div",
      {},
      h(
        "p",
        {},
        payload.action === "approve"
          ? b.status === "pending_hod"
            ? "Confirm final approval? The supervisor, scholar, panel members, and HOD will receive a notification."
            : "Forward this request to the HOD for final approval?"
          : "This closes the request and releases the day. The recorded history will be preserved.",
      ),
      h("p", { class: "muted" }, payload.note),
      h(
        "div",
        { class: "form-actions" },
        btn("Go back", () => detail(b.id)),
        btn(
          "Confirm decision",
          async (e) => {
            const button = e.currentTarget;
            button.disabled = true;
            try {
              await api("/bookings/" + b.id + "/action", "POST", payload);
              closeModal();
              await load();
              toast("Decision saved.");
            } catch (error) {
              confirmation.prepend(
                h("p", { class: "form-error", role: "alert" }, error.message),
              );
              button.disabled = false;
            }
          },
          payload.action === "approve" ? "button primary" : "button danger",
        ),
      ),
    );
    modal("Confirm your decision", confirmation);
  });
  return f;
}

function scholarsPage() {
  setPage(
    pageHeader(
      "PEOPLE & RESEARCH",
      "Scholars & mapping",
      "Scholar details and supervisor mapping are maintained by the coordinator.",
      manager()
        ? btn("Add research scholar", scholarModal, "button primary", "plus")
        : null,
    ),
    h(
      "section",
      { class: "panel" },
      h(
        "div",
        { class: "panel-heading" },
        h("h2", {}, "Research scholars"),
        h(
          "span",
          { class: "muted small" },
          state.scholars.length + " scholars",
        ),
      ),
      state.scholars.length
        ? h(
            "div",
            { class: "people-list" },
            state.scholars.map((s) =>
              h(
                "article",
                { class: "person-row" },
                h("span", { class: "avatar pale" }, initials(s.name)),
                h(
                  "div",
                  { class: "person-info" },
                  h("h3", {}, s.name),
                  h(
                    "p",
                    { class: "small muted" },
                    s.registration_id + " · ",
                    emailLink(s.email),
                  ),
                  h("p", { class: "small" }, s.research_area),
                ),
                h(
                  "div",
                  { class: "mapping" },
                  h("span", { class: "small muted" }, "SUPERVISOR"),
                  h("strong", {}, s.supervisor_name),
                ),
                manager()
                  ? btn(
                      "Change mapping",
                      () => mappingModal(s),
                      "button secondary compact",
                    )
                  : null,
              ),
            ),
          )
        : empty(
            "No scholars mapped",
            "Ask your coordinator to add a scholar and supervisor mapping.",
          ),
    ),
  );
}
function scholarModal() {
  const f = h(
    "form",
    {},
    h(
      "div",
      { class: "form-grid" },
      field("Full name", "name", "text", {
        required: true,
        minlength: 2,
        maxlength: 100,
      }),
      field("Registration ID", "registration_id", "text", {
        required: true,
        minlength: 3,
        maxlength: 40,
      }),
      field("Scholar email", "email", "email", {
        required: true,
        maxlength: 254,
      }),
      select(
        "Supervisor",
        "supervisor_id",
        state.faculty
          .filter((p) => p.role === "supervisor" && p.active)
          .map((p) => ({ value: p.id, label: p.name })),
      ),
    ),
    field("Research area (optional)", "research_area", "text", {
      maxlength: 160,
    }),
    h(
      "p",
      { class: "small muted" },
      "Scholar records receive email confirmation. Adding a scholar record does not create a sign-in account.",
    ),
    h(
      "div",
      { class: "form-actions" },
      btn("Cancel", closeModal),
      h("button", { type: "submit", class: "button primary" }, "Add scholar"),
    ),
  );
  submitForm(f, async (d) => {
    await api("/scholars", "POST", Object.fromEntries(d));
    closeModal();
    await load();
    toast("Scholar added and mapped to a supervisor.");
  });
  modal("Add research scholar", f);
}
function mappingModal(s) {
  const f = h(
    "form",
    {},
    h("p", {}, s.name),
    select(
      "Supervisor",
      "supervisor_id",
      state.faculty
        .filter((p) => p.role === "supervisor" && p.active)
        .map((p) => ({
          value: p.id,
          label: p.name,
          selected: p.id === s.supervisor_id,
        })),
    ),
    h(
      "p",
      { class: "small muted" },
      "A scholar with an active pre-talk cannot be remapped. Close that request first.",
    ),
    h(
      "div",
      { class: "form-actions" },
      btn("Cancel", closeModal),
      h("button", { type: "submit", class: "button primary" }, "Save mapping"),
    ),
  );
  submitForm(f, async (d) => {
    await api("/scholars/" + s.id, "PATCH", Object.fromEntries(d));
    closeModal();
    await load();
    toast("Supervisor mapping updated.");
  });
  modal("Change supervisor mapping", f);
}
function peoplePage() {
  setPage(
    pageHeader(
      "FACULTY & ACCESS",
      "Faculty & access",
      "Department accounts are provisioned here. Each account has one clearly defined role.",
      btn("Add faculty account", userModal, "button primary", "plus"),
    ),
    h(
      "section",
      { class: "panel" },
      h(
        "div",
        { class: "people-list" },
        state.faculty.map((p) =>
          h(
            "article",
            { class: "person-row" },
            h("span", { class: "avatar pale" }, initials(p.name)),
            h(
              "div",
              { class: "person-info" },
              h("h3", {}, p.name),
              h(
                "p",
                { class: "small muted" },
                emailLink(p.email),
                " · " + p.faculty_id,
              ),
            ),
            h("span", { class: "role-chip" }, roles[p.role]),
            h(
              "span",
              { class: `badge ${p.active ? "green" : "gray"}` },
              p.active ? "Active" : "Inactive",
            ),
            p.id !== state.user.id &&
              p.role !== "admin" &&
              p.role !== "hod" &&
              (state.user.role === "admin" || p.role !== "coordinator")
              ? btn(
                  p.active ? "Disable" : "Enable",
                  () => toggleAccount(p),
                  "button secondary compact",
                )
              : null,
          ),
        ),
      ),
    ),
  );
}
function userModal() {
  const f = h(
    "form",
    {},
    h(
      "div",
      { class: "form-grid" },
      field("Full name", "name", "text", {
        required: true,
        minlength: 2,
        maxlength: 100,
      }),
      field("Faculty ID", "faculty_id", "text", {
        required: true,
        minlength: 3,
        maxlength: 40,
      }),
      field("Email address", "email", "email", { required: true }),
      select(
        "Role",
        "role",
        [
          "supervisor",
          "panel",
          "hod",
          ...(state.user.role === "admin" ? ["coordinator"] : []),
        ].map((v) => ({ value: v, label: roles[v] })),
      ),
    ),
    field("Initial password · at least 12 characters", "password", "password", {
      required: true,
      minlength: 12,
      maxlength: 128,
      autocomplete: "new-password",
    }),
    h(
      "div",
      { class: "info-banner" },
      "Provide the initial password through a secure channel. This application does not email passwords.",
    ),
    h(
      "div",
      { class: "form-actions" },
      btn("Cancel", closeModal),
      h(
        "button",
        { type: "submit", class: "button primary" },
        "Create account",
      ),
    ),
  );
  submitForm(f, async (d) => {
    await api("/users", "POST", Object.fromEntries(d));
    closeModal();
    await load();
    toast("Faculty account created.");
  });
  modal("Add faculty account", f);
}
function toggleAccount(p) {
  const content = h(
    "div",
    {},
    h(
      "p",
      {},
      `${p.active ? "Disable" : "Enable"} access for ${p.name}? ${p.active ? "Their current sessions will end. History is preserved." : ""}`,
    ),
    h(
      "div",
      { class: "form-actions" },
      btn("Go back", closeModal),
      btn(
        "Confirm",
        async (e) => {
          const button = e.currentTarget;
          button.disabled = true;
          try {
            await api("/users/" + p.id, "PATCH", { active: !p.active });
            closeModal();
            await load();
            toast("Account access updated.");
          } catch (error) {
            content.prepend(
              h("p", { class: "form-error", role: "alert" }, error.message),
            );
            button.disabled = false;
          }
        },
        "button primary",
      ),
    ),
  );
  modal("Update account access", content);
}
function notificationsPage() {
  setPage(
    pageHeader(
      "YOUR INBOX",
      "Notifications",
      "Final confirmations and cancellations for pre-talks you are part of.",
      state.notifications.some((n) => !n.read_at)
        ? btn(
            "Mark all as read",
            async () => {
              await api("/notifications/read", "POST", {});
              await load();
              toast("Notifications marked as read.");
            },
            "button secondary",
            "check",
          )
        : null,
    ),
    h(
      "section",
      { class: "panel" },
      state.notifications.length
        ? h(
            "div",
            { class: "notifications-list" },
            state.notifications.map((n) =>
              h(
                "button",
                {
                  class: `notification-row ${n.read_at ? "" : "unread"}`,
                  onClick: () => detail(n.booking_id),
                },
                h("span", { class: "metric-icon blue" }, icon("bell")),
                h(
                  "div",
                  {},
                  h("strong", {}, n.subject),
                  h(
                    "p",
                    { class: "muted" },
                    n.kind === "approved"
                      ? "The final approval is in. View the confirmed date, venue, and panel."
                      : "The pre-talk was cancelled. Open the history for the recorded reason.",
                  ),
                  h(
                    "span",
                    { class: "small muted" },
                    new Date(n.created_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    }) + " IST",
                  ),
                ),
                icon("chevron"),
              ),
            ),
          )
        : empty(
            "You’re up to date",
            "Notifications appear after final approval, and if a confirmed pre-talk is cancelled.",
          ),
    ),
  );
}
async function outboxPage() {
  setPage(
    pageHeader(
      "DELIVERY & CONFIRMATIONS",
      "Email outbox",
      state.mailMode === "capture"
        ? "Demo capture mode is active. Messages are stored here; no external email is sent."
        : "Messages are queued durably and delivered through the configured SMTP service.",
    ),
    h(
      "section",
      { class: "panel", id: "outbox-rows" },
      h("p", { class: "loading" }, "Loading email records…"),
    ),
  );
  try {
    const rows = await api("/outbox");
    if (route !== "outbox") return;
    $("#outbox-rows").replaceChildren(
      rows.length
        ? h(
            "div",
            { class: "mail-list" },
            rows.map((n) =>
              h(
                "article",
                { class: "mail-row" },
                icon("mail"),
                h(
                  "div",
                  {},
                  h("h3", {}, n.subject),
                  h(
                    "p",
                    { class: "small muted" },
                    "To: ",
                    emailLink(n.recipient),
                  ),
                  h(
                    "details",
                    {},
                    h("summary", {}, "View message"),
                    h("pre", {}, n.body),
                  ),
                  n.last_error &&
                    h("p", { class: "small error-text" }, n.last_error),
                ),
                h(
                  "span",
                  {
                    class: `badge ${["captured", "sent"].includes(n.state) ? "green" : "amber"}`,
                  },
                  {
                    captured: "Demo captured",
                    sent: "Sent",
                    pending: "Queued",
                    sending: "Sending",
                  }[n.state],
                ),
              ),
            ),
          )
        : empty(
            "No email records yet",
            "Messages are created after final approval.",
          ),
    );
  } catch (e) {
    if (route === "outbox")
      $("#outbox-rows").replaceChildren(
        empty("Unable to load messages", e.message),
        btn("Retry", outboxPage),
      );
  }
}
async function auditPage() {
  setPage(
    pageHeader(
      "ACCOUNTABILITY",
      "Activity log",
      "Account changes, mappings, dates, and decisions are recorded with their actor.",
    ),
    h(
      "section",
      { class: "panel", id: "audit-rows" },
      h("p", { class: "loading" }, "Loading activity…"),
    ),
  );
  try {
    const rows = await api("/audit");
    if (route !== "audit") return;
    $("#audit-rows").replaceChildren(
      rows.length
        ? h(
            "ol",
            { class: "audit-list" },
            rows.map((n) =>
              h(
                "li",
                {},
                h("span", { class: "avatar pale" }, initials(n.actor_name)),
                h(
                  "div",
                  {},
                  h("strong", {}, n.action.replaceAll("_", " ")),
                  h("p", { class: "small muted" }, n.actor_name),
                  h(
                    "details",
                    {},
                    h("summary", {}, "View recorded change"),
                    h(
                      "pre",
                      {},
                      JSON.stringify(JSON.parse(n.details), null, 2),
                    ),
                  ),
                ),
                h(
                  "span",
                  { class: "small muted" },
                  new Date(n.created_at).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  }) + " IST",
                ),
              ),
            ),
          )
        : empty(
            "Activity will appear here",
            "Changes are recorded as the workspace is used.",
          ),
    );
  } catch (e) {
    if (route === "audit")
      $("#audit-rows").replaceChildren(
        empty("Unable to load activity", e.message),
        btn("Retry", auditPage),
      );
  }
}
function guidePage() {
  const perms = [
    [
      "Department admin / coordinator",
      "Maintain faculty accounts and scholar mappings; enable dates; give first approval; cancel confirmed talks.",
    ],
    [
      "Supervisor",
      "View mapped scholars, reserve a day with a manually entered venue and time, and withdraw pending requests.",
    ],
    [
      "Head of department",
      "View department requests and give final approval or rejection after coordinator approval.",
    ],
    [
      "Panel member",
      "Read assigned pre-talks, their histories, and final notifications. No booking or approval access.",
    ],
    [
      "Research scholar",
      "Optional demo read-only access to their own request and notifications.",
    ],
  ];
  setPage(
    pageHeader(
      "WORKSPACE GUIDE",
      "Roles & workflow",
      "This independent demonstration implements the supplied pre-talk workflow.",
    ),
    h(
      "section",
      { class: "panel guide-panel" },
      h("h2", {}, "Who can do what"),
      h(
        "dl",
        {},
        perms.map(([title, desc]) =>
          h("div", {}, h("dt", {}, title), h("dd", {}, desc)),
        ),
      ),
    ),
    h(
      "section",
      { class: "panel guide-panel" },
      h("h2", {}, "Workflow & documented assumptions"),
      h(
        "ol",
        { class: "guide-list" },
        h(
          "li",
          {},
          "The coordinator creates scholar mappings and enables future department dates.",
        ),
        h(
          "li",
          {},
          "A supervisor chooses a mapped scholar, enters time and venue, and selects panel members. Submission reserves the whole day.",
        ),
        h(
          "li",
          {},
          "The coordinator reviews first. Only then can the HOD give final approval.",
        ),
        h(
          "li",
          {},
          "Final approval creates in-app notifications and email records for the supervisor, scholar, assigned panel, and HOD.",
        ),
        h(
          "li",
          {},
          "Assumption: rejection and cancellation require a reason, preserve history, and release the date. A new submission starts approvals again.",
        ),
        h(
          "li",
          {},
          "Assumption: supervisors may cancel pending requests. Only the coordinator/admin may cancel confirmed future talks; cancellation messages go to the original participants.",
        ),
        h(
          "li",
          {},
          "Assumption: submitted details cannot be edited. Cancel and rebook so approvals always refer to the reviewed details.",
        ),
        h(
          "li",
          {},
          "Assumption: dates must be in the future in IST. At least one panel member is required; four or five is recommended.",
        ),
      ),
    ),
    faqSection(),
    h(
      "div",
      { class: "info-banner" },
      icon("shield"),
      "Independent demonstration. All seeded names, IDs, research topics, and accounts are fictional. SRMIST’s visual language is inspiration only; no official endorsement is implied.",
    ),
  );
}

initializeEnhancements({
  h,
  btn,
  icon,
  modal,
  closeModal,
  toast,
  search: searchPortal,
  help: () =>
    state
      ? navigate("guide")
      : $("#login-faq")?.scrollIntoView({ block: "center" }),
});

try {
  const me = await api("/session");
  if (me.authenticated) {
    csrf = me.csrf;
    await load();
  } else login();
} catch {
  login();
}
