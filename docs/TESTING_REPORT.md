# Ph.D. Pre-talk Portal — implementation and verification report

Verified on 21 October 2026. Project: `D:\SCHOLAR VENUE`. Live preview: http://127.0.0.1:4173/.

## Final results

| Verification | Result |
|---|---|
| Backend, process-concurrency, preference-policy and sample-account tests | **40 passed**, zero failures |
| Browser end-to-end tests | **30 passed**, zero failures, final full run 2.9 minutes |
| Base browser-suite accounts exercised | **All 11**, covering admin, coordinator, two supervisors, HOD, four panel accounts, scholar, and a second department |
| Extended live demo accounts | **31/31 passed** sign-in, department scope, permitted navigation, request display and sign-out checks |
| Role/page combinations | **80** permitted combinations, each checked at 320px, 390px and 1440px |
| Other widths | Dashboard checks at 360px, 768px and 1024px |
| Dark theme | All 10 coordinator pages, public sign-in, public 404, contact and mobile menu checked with selected axe rules; narrow-width reflow checked |
| Dependency audit | **0 known vulnerabilities** reported by npm audit |
| Live database | Integrity check **ok**; foreign-key errors **0** |
| Print output | Representative confirmed request fits **one A4 page**, including venue/time, panel and all three approval-history events |

The 40 Node tests comprise 31 backend/site/process tests, five campaign-consent/storage tests and four extended sample-account tests. Browser tests use Microsoft Edge through Playwright with one worker and an isolated in-memory server on port 4174. They do not reset or mutate the live demonstration database on port 4173.

## Extended sample accounts

The user's project-root `table` file now lists **31 fictional accounts** across CSE and ECE, with at least two accounts for each of the six roles in each department. Twenty accounts, seven scholar mappings and four pending sample requests were added to the original live demonstration. Existing data and passwords were preserved. A second provisioning run added zero rows.

The four new tests verify all 31 account logins and department/role scopes, populated scholar and panel access, additive/idempotent provisioning, preservation of changed passwords and disabled accounts, rejection of production/identity conflicts, and sequential coordinator/HOD approval in ECE with duplicate-decision protection. Plaintext changed passwords and stored password hashes are never exported into the credential table. The original 30-test browser suite uses the unchanged base seed; the extended live set is checked separately for sign-in, department scope, permitted navigation, request display and sign-out.

## Institutional design

The current official SRMIST [homepage](https://www.srmist.edu.in/) and [Academic Research page](https://www.srmist.edu.in/research/academic-research/) were visually inspected. The active [theme stylesheet](https://www.srmist.edu.in/wp-content/themes/oceanwp-child-theme/style.css?ver=3.1.1) was reviewed for its actual colors and typography references.

The delivered interface uses blue `#0c4da2`, yellow `#e4b316`, a compact institutional masthead, the user-requested SRM logo, horizontal desktop navigation, formal headings, summary metrics and flat record rows. The mobile menu replaces desktop navigation at 1200px so long role-specific menus cannot wrap into a second row. Source Sans 3 is served locally with its SIL Open Font License; Georgia provides the serif heading treatment. No proprietary SRM font files or campus photography were copied.

An independent-demo label remains in the header and footer. All people, account IDs and research topics are fictional. No real SRM credentials, production accounts or secrets are provided. The contact control links to the published institutional information address `infodesk@srmist.edu.in`; no phone number is shown. No official affiliation or endorsement is claimed.

## Functional coverage

| Area | Checks performed |
|---|---|
| Authentication | All seeded accounts sign in; normalized email, hashed passwords, opaque protected sessions, expiry, logout, deactivation and throttling checked |
| Authorization | Server role/department/ownership/assigned-panel matrix; forbidden controls and record access; no HOD bypass or client role escalation |
| Directory and mapping | Faculty provisioning and enable/disable; scholar creation and supervisor changes; active assignments prevent unsafe remapping/deactivation |
| Scheduling | Coordinator-enabled dates, mapped scholars only, manual venue/time, panel selection, one live request per scholar |
| Concurrent booking | Two independent Node processes race for one department/day using different venues/times; exactly one wins and no orphan rows remain |
| Approvals | Coordinator then HOD; reasons for rejection/cancellation; stale versions rejected; two independent HOD approvals create only one decision/notification set |
| Cancellation/history | Supervisor withdrawal of pending requests, manager cancellation of confirmed future talks, day release, preserved history and original-recipient notification snapshot |
| Notifications/mail | Recipient scope, deduplication, atomic rollback, capture mode, SMTP-failure retries and expired-lease recovery |
| Navigation/pages | Every permitted page, custom HTTP 404 and hash-route errors, titles/descriptions/favicon, home/help/logo links and email links |
| Feedback | Success after completion; validation and connection errors retain inputs; disabled/busy controls recover; confirmation dialogs precede decisions/access changes |

## The 20 requested controls

All 20 items from the user's screenshot are implemented and documented in `docs/PORTAL_TOOLS.md`:

1. Dark mode with a saved explicit preference.
2. Cookie banner and revisitable preferences.
3. Scoped portal-wide search and Ctrl/Cmd + K.
4. Back-to-top control.
5. Role-aware mobile menu.
6. Loading and busy feedback with reduced-motion behavior.
7. Hover and keyboard-focus states.
8. Scroll progress bar.
9. Copy schedule and demo-password controls, success feedback and clipboard-denial recovery.
10. Print control and dedicated stylesheet.
11. Sticky masthead and dialog headers.
12. Skip-to-main-content link.
13. Sign-in password visibility toggle.
14. Consent-controlled first-touch UTM attribution.
15. Form success states.
16. Form error states.
17. Confirmation modals.
18. Data-refresh/revision dates.
19. Expandable FAQ.
20. Floating institutional contact/help control.

Search results are compared against each account's authorized bootstrap records. Campaign tests confirm that only the five allowed UTM fields are retained, untrusted values are bounded, nothing is stored before consent, first-touch attribution survives navigation within the tab, and withdrawal clears the record. Attribution is local and optional; no analytics provider or server-side campaign database is configured. Normal URL query strings are still part of HTTP navigation.

The print control is exercised, a PDF is generated, the representative record is checked for a single page, and its rendered page is visually inspected. The record, panel and complete history are present; navigation, cookie controls and approval buttons are absent. Longer summaries/history may naturally require additional pages.

## Responsive, keyboard and visual checks

- Document overflow and visible nested horizontal scrolling containers are checked for every role/page at the three principal widths.
- Mobile navigation opens, closes with Escape, restores focus, navigates, signs out, and exposes only the current role's links.
- Keyboard skip-to-content preserves the route. Dialog Escape/focus behavior, populated-search Escape, and native FAQ disclosure are exercised.
- Selected axe WCAG A/AA rules are run across every role's pages, all coordinator dark pages, public forms/errors, and selected mobile/dialog states.
- Desktop/mobile login, overview, approval queue, details, menu, search and dark-theme screenshots are retained. The live portal is also inspected in the Codex in-app browser.
- Browser exceptions and console errors are captured in the role/flow checks.

During verification, the search field's native Escape behavior was found to keep the dialog open; an explicit close handler resolved it. Empty search groups were also filtered to prevent stray text. Clipboard-denial recovery received a separate label element, and the print layout was compacted after the first PDF inspection. The full 30-test browser run passed after these corrections.

## Page height and navigation update

The default sign-in page fits without document scrolling at 1440×900, 1366×768, 1280×720, 1024×768, 960×720, 900×720, 768×1024, 768×720, 681×720, 390×844 and 320×700. At 1280×720, its document height decreased from 1125px to 720px. The demo chooser starts collapsed below 800px height or at widths up to 960px; scheduling help starts collapsed at widths up to 960px. Both remain keyboard-operable native disclosures and adapt when crossing these layout breakpoints. Expanding them or showing an error can naturally require scrolling.

All six primary roles' live overviews fit at 1280×720. The coordinator overview decreased from 1155px to 720px. Overview panels show up to two previews; their full-list controls retain access to every record. Reviewers open their approval queue; other users open their pending requests. The confirmed-list control opens the Confirmed filter.

A separate Playwright check visited **96 live role/page/viewport combinations** across all six roles at 1280×720 and 390×844. It verified meaningful page identity, zero horizontal overflow, no nested vertical scrolling regions, visible headings below the sticky header, and navigation starting at the top. No browser exceptions or console errors were recorded. The main browser suite also checks 320px reflow, keyboard controls, selected axe rules, dark mode, errors, print output and the complete approval workflow.

Additional checks verified both overview full-list controls for all six roles, including the displayed pending count and matching destination records. The tablet menu closes when resizing from 1100px to 1280px. Login disclosures adapt when resizing from 1440×900 through laptop and phone viewports without introducing default-page scrolling. The complete 30-test browser suite passed after the layout changes, in 2.9 minutes; the two targeted server/static-page checks also passed.

Shared header, breadcrumb, heading, panel, calendar, row and footer spacing was reduced. Short pages fit the viewport; longer registers, calendar months, help content, expanded disclosures and dialogs retain natural scrolling. Scrolling is not disabled and records are not clipped to enforce a viewport height. Desktop overview preview titles can use ellipsis; full titles remain in the request list and detail view.

This update uses project Playwright with Microsoft Edge because the Browser plugin and browser skill are not available in this session. It is desktop browser emulation, not native-phone certification.

## Assets and delivery

| Asset | Delivered size |
|---|---:|
| White SRM logo SVG | 79,262 bytes, reduced 54.4% |
| Color SRM logo SVG | 79,291 bytes, reduced 54.3% |
| Favicon PNG | 524 bytes |
| Self-hosted Latin variable font | 28,872 bytes |

Compression is enabled for accepting clients and is covered by server tests. Scripts, styles, logo and favicon links resolve successfully. Asset origins and font licensing are recorded in `public/assets/ATTRIBUTION.md`.

The source archive excludes dependencies, live database files, `.env`, browser traces and logs. It includes migrations, seed/provisioning scripts, tests, setup instructions and design/engineering documentation.

## Practical limits

Outbound email remains in **demo capture mode**. Real SMTP delivery, institutional SSO, production hosting, native-device testing, a penetration test and full accessibility certification are not claimed. The selected automated accessibility checks do not replace a complete assistive-technology assessment. Rejection, cancellation and editing assumptions remain explicitly documented in `docs/REQUIREMENTS.md` and portal Help.

## Re-run

```powershell
Set-Location 'D:\SCHOLAR VENUE'
npm ci
npm run check
npm run test:e2e
npm audit
```

The live preview uses the existing `.env` and persistent demo database. For a fresh installation, follow the setup guide and seed only an empty development database.
