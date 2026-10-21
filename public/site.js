export const institutionEmail = "infodesk@srmist.edu.in";
export const currentYear = () =>
  new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
  }).format(new Date());
export const pageDescriptions = {
  overview:
    "View departmental PhD pre-talk requests, pending approvals, confirmed schedules, and available dates.",
  calendar:
    "View enabled department dates and reserved days for PhD pre-talk scheduling.",
  requests:
    "Search PhD pre-talk requests and review their status, schedule, panel, and history.",
  approvals:
    "Review PhD pre-talk requests through coordinator approval followed by HOD approval.",
  scholars:
    "View research scholars and their supervisor mappings within the department.",
  people:
    "Manage department faculty accounts, roles, and access to the PhD pre-talk portal.",
  notifications:
    "Read final approval and cancellation notifications for your assigned PhD pre-talks.",
  outbox:
    "Review email confirmations, cancellation messages, and delivery status for PhD pre-talks.",
  audit:
    "Review the department activity log for scheduling, approval, account, and mapping changes.",
  guide:
    "Understand the pre-talk workflow, role permissions, and booking rules.",
  login:
    "Sign in to the independent SRMIST-inspired PhD pre-talk scheduling and approval demonstration.",
  notFound:
    "The requested page could not be found. Return to the PhD pre-talk portal.",
  forbidden:
    "Your account does not have access to this page of the PhD pre-talk portal.",
};
export function setPageMetadata(title, key) {
  document.title = `${title} · PhD Pre-talks | SRMIST Demo`;
  document.querySelector('meta[name="description"]').content =
    pageDescriptions[key] || pageDescriptions.notFound;
}
