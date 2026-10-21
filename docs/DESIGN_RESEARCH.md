# Design research and decisions

Reviewed on 21 October 2026, including a second live comparison for the institutional redesign.

## Official visual reference

The live [SRM Institute of Science & Technology homepage](https://www.srmist.edu.in/) was inspected in the in-app browser. The text fetch returned HTTP 403, but the browser loaded the actual page with title **“SRM Institute of Science & Technology - Learn. Leap. Lead.”**

Observed first viewport: an institutional mark at upper left, multi-level audience and subject navigation, prominent campus-building video/imagery, blue and white institutional treatment, gold/yellow admission and announcement accents, and formal academic/research language. This is visual research, not a claim about a published SRM design-token specification.

The current [Academic Research page](https://www.srmist.edu.in/research/academic-research/) was also opened and visually inspected: a wide institutional masthead, formal serif page heading, breadcrumb, pale-blue section background, and blue/yellow accents. The active [child-theme stylesheet](https://www.srmist.edu.in/wp-content/themes/oceanwp-child-theme/style.css?ver=3.1.1) was retrieved directly. It repeatedly references blue `#0c4da2`, yellow `#e4b316`, and pale blue `#e0e8f2`, alongside Source Sans Pro, Gilroy, and Butler font families. These are observed values from the site's implementation, not an official design-system certification.

The official [research division's PhD admissions page](https://medicalresearch.srmist.edu.in/phd-admission/) and [admissions portal](https://applications.srmist.edu.in/) were also read as institutional context. Their current policies are not used as approval rules: this application follows the supplied transcript and user request.

## Translation to an operational product

| Reference observation | Product decision |
|---|---|
| Blue institutional identity and yellow accents | `#0c4da2` masthead and actions, `#062651` utility bar, `#e4b316` navigation accents and contact control, white/pale-blue content surfaces |
| Formal academic hierarchy | Georgia serif page/section headings and self-hosted Source Sans 3 for controls and records; the open-font license is bundled |
| Wide institutional masthead and navigation | Prominent original SRMIST logo, portal/department identity, horizontal role-aware desktop navigation, and a native mobile drawer |
| Research pages with simple rectangular sections | Compact summary strip, flat record rows, small corner radii, clear rules and date/status information |
| Multiple public audience groups | Distinct staff roles, account identity, scoped search and actions, and visible approval stages |
| Functional departmental service | Scheduling and review content takes priority; public-site rankings, admissions, marketing copy, and campus media are not added to the service |

Product identity: **Ph.D. Pre-talk Portal**. On the user's follow-up request, the official SRMIST logo and favicon were added to the login/workspace from asset URLs referenced by the official homepage. The SVG files are served locally, optimized to preserve the artwork with smaller markup, and contain no scripts or external references. Attribution and the font license are recorded in `public/assets/ATTRIBUTION.md`. Both desktop and mobile identify this as an independent demo without affiliation or endorsement. No official credentials or campus photographs are used.

The user's follow-up also requested direct language without slogans. Page titles and login text use task labels such as “Pre-talk overview,” “Manage dates,” “Approval queue,” and “Sign in.” The overview contains request counts, the relevant review queue and upcoming schedules. The full approval sequence and assumptions are in Help. The 20 additional requested controls are documented in `docs/PORTAL_TOOLS.md`.

## Skills reviewed

- `frontend-design`: product/workspace mode, full state model, semantic controls, responsive reflow, rendered verification.
- `design-taste-frontend`: reviewed the brief-inference and anti-default guidance. Its stated primary scope excludes dashboards; the workspace-specific frontend-design guidance takes precedence here.
- `ui-ux-pro-max`: searched the local design catalog for university/research/administration. Adopted institutional navy and readability guidance; rejected its irrelevant portfolio-grid recommendation for this operational app.
- `security-best-practices`: Express and general browser JavaScript references; applied server-side authorization, validated inputs, secure sessions, origin/CSRF controls, safe DOM construction, and dependency checks.
- `pdf`: extracted all five transcript pages and preserved page boundaries for requirement traceability.
- `frontend-testing-debugging` and `playwright`: rendered testing, representative widths, console/error inspection, interaction checks, keyboard and screenshot evidence. A dedicated Browser plugin/`browser` skill is not listed in this session; the automated suite uses Playwright with installed Edge. The in-app browser was also used for manual review.
- `sites`: reviewed routing and local-preview guidance. The explicit request is for a local coding workspace and working backend in `D:\SCHOLAR VENUE`; no hosted Site was registered or published.

## Accessibility and resilience

Local assets and the bundled 28,872-byte Source Sans 3 WOFF2 remove runtime CDN dependency. Georgia is a system fallback; SRM's Gilroy and Butler font files are not copied. The app uses labels, landmarks, visible focus, text status labels, native dialog focus behavior, keyboard Escape, form errors, busy submit controls, connection failure messages and reduced-motion support. Both light and dark themes use semantic color variables. The automated suite checks axe's selected WCAG A/AA rules and responsive overflow. This is evidence of specific checks, not a claim of comprehensive WCAG conformance or screen-reader certification.

