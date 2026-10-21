import {
  initializeEnhancements,
  utilityControls,
  openPrivacy,
} from "./enhancements.js";
function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith("on"))
      node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value != null) node.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity))
    if (child != null)
      node.append(
        child instanceof Node ? child : document.createTextNode(child),
      );
  return node;
}
const paths = {
  search: "m21 21-5-5m2-6a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  moon: "M20 15a9 9 0 0 1-11-11 9 9 0 1 0 11 11Z",
  sun: "M12 1v3m0 16v3M1 12h3m16 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2m-2 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
  up: "m6 12 6-6 6 6M12 6v14",
  mail: "M3 5h18v14H3zm0 0 9 8 9-8",
  close: "m6 6 12 12M6 18 18 6",
};
function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [key, value] of Object.entries({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.6",
    "aria-hidden": "true",
  }))
    svg.setAttribute(key, value);
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", paths[name] || paths.mail);
  svg.append(path);
  return svg;
}
const btn = (label, fn, cls = "button secondary", ico) =>
  h(
    "button",
    { type: "button", class: cls, onClick: fn },
    ico ? icon(ico) : null,
    label,
  );
const dialog = document.querySelector("#dialog");
let focusBefore;
function modal(title, content) {
  focusBefore = document.activeElement;
  dialog.replaceChildren(
    h(
      "div",
      { class: "dialog-head" },
      h("h2", { id: "dialog-title" }, title),
      btn("Close", () => dialog.close(), "icon-button", "close"),
    ),
    content,
  );
  if (!dialog.open) dialog.showModal();
}
dialog.addEventListener("close", () => focusBefore?.focus());
function toast(message) {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("visible"), 5000);
}
initializeEnhancements({
  h,
  btn,
  icon,
  modal,
  closeModal: () => dialog.close(),
  toast,
  help: () => {
    location.href = "/#guide";
  },
  search: () =>
    modal(
      "Search portal",
      h(
        "div",
        {},
        h(
          "p",
          { class: "muted" },
          "Return to the portal to search your permitted pages and records.",
        ),
        h(
          "div",
          { class: "form-actions" },
          h("a", { href: "/", class: "button primary" }, "Portal home"),
        ),
      ),
    ),
});
document.querySelector("#error-tools").append(utilityControls());
document.querySelector("#privacy-link").addEventListener("click", openPrivacy);
document.querySelector(".skip-link").addEventListener("click", (e) => {
  e.preventDefault();
  document.querySelector("#main").focus();
});
