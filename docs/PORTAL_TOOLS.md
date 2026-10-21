# Portal controls and page behavior

Implemented from the user's 20-item screenshot on 21 October 2026. These controls use local JavaScript and the existing application; no external analytics, UI service, or production credentials are configured.

| # | Requested item | Where and how it works |
|---|---|---|
| 1 | Dark mode toggle | Header moon/sun control. The institutional light theme is the default. An explicit theme choice is saved locally and also applies to the custom 404 page. |
| 2 | Simple cookie banner | First-visit notice with **Necessary only** and **Allow campaign tracking**. Reopen it through **Cookie preferences** in the footer. The essential sign-in cookie remains HttpOnly/SameSite=Strict. |
| 3 | Site search | Header search or **Ctrl/Cmd + K**. Searches permitted pages, scoped pre-talks, and scholar records already authorized by the backend. A result opens the record or page. Public search links to sign-in and FAQ. Escape closes the search dialog. |
| 4 | Back to top | Floating up-arrow appears after scrolling 360 pixels; returns to the top and focuses main content. Reduced-motion preference removes smooth scrolling. |
| 5 | Mobile menu | Role-aware native dialog drawer at widths up to 1200px, preventing a wrapped desktop menu. Supports Escape, focus return, navigation, help, and sign-out; closes when the viewport widens past this breakpoint. |
| 6 | Loading animations | Busy submit/action buttons, loading indicators on asynchronous lists, and a request progress strip. Controls recover after a failure. Motion is removed when requested by the device. |
| 7 | Hover states | Buttons, navigation, results, request rows, links, calendar dates, and FAQ controls have visible hover feedback and keyboard focus styles. |
| 8 | Scroll progress bar | Thin yellow bar at the viewport top represents actual document scroll progress. Hidden when the page does not need scrolling. |
| 9 | Copy button | **Copy schedule** in authorized pre-talk details and **Copy demo password** on sign-in. Success feedback follows an actual clipboard write. A selectable-text dialog provides recovery when clipboard access is unavailable. |
| 10 | Print stylesheet | **Print pre-talk** in record details opens browser printing. Print output contains the chosen record, panel and history; navigation, decision controls and floating tools are excluded. Browser printing also formats the current page when no record dialog is open. |
| 11 | Sticky headers | Institutional masthead and navigation remain visible during page scrolling. Long dialogs keep their heading and close control available. |
| 12 | Skip to content | Keyboard-focusable **Skip to main content** link preserves the current page and moves focus to main content. |
| 13 | Password visibility toggle | **Show password** checkbox on sign-in reveals/hides the entered password without submitting the form. |
| 14 | UTM tracking | Explicitly opt-in, first-touch attribution for `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, and `utm_content`. Values are bounded. Records stay in tab-scoped session storage; this app does not send campaign records to analytics or persist them in its database. Normal URL requests still include their query string. |
| 15 | Form success state | Sign-in/out, submission, mapping, date, account and decision operations show success only after completion. |
| 16 | Form error state | Inline alerts retain form values, focus the error, and restore submit controls. Connection errors and failed actions have clear feedback. Server-side validation and authorization remain authoritative. |
| 17 | Confirmation modals | Booking decisions, withdrawal/cancellation, and access changes display a concrete confirmation before the mutation. Native dialog behavior provides keyboard focus containment and Escape. |
| 18 | Last updated date | Authenticated footer shows the actual bootstrap refresh time in IST. Public pages show the interface revision date. The label identifies data refresh separately from release date. |
| 19 | Expandable FAQ | Native disclosure controls on sign-in and **Help & roles**. Covers submission, reservation timing, approvals, cancellation assumptions, access and fictional accounts. |
| 20 | Floating contact button | Yellow envelope opens **Contact & help**. The published institutional information address is clickable. It is an institutional enquiry destination, not an assertion that SRMIST supports this independent portal. No phone number is included. |

## Page height

Sign-in fits the tested default viewports from 320×700 to 1440×900. **Demo accounts** expands the role chooser on short or narrow screens. **About pre-talk scheduling & help** expands the public instructions and FAQ on narrow screens. Expanding optional content, opening a large form, or viewing a long register can require vertical scrolling. Shared page navigation resets to the top while moving keyboard focus to the main content.

## Storage and data boundaries

- `research_session`: essential server session cookie, eight-hour expiry, cleared on sign-out. Its opaque value is not accessible to frontend JavaScript.
- `pretalk.theme`: local theme preference.
- `pretalk.preferences.v1`: explicit optional campaign-tracking choice in local storage.
- `pretalk.campaign.v1`: consented campaign parameters and capture time in session storage. Closing the tab ends that record; withdrawing consent removes it immediately.
- Booking, user, scholar and notification records remain in the server database. They are not copied to preference storage.

Local storage restrictions do not prevent sign-in or ordinary portal operation. Copy and print require the browser's normal capabilities; clipboard denial has a visible recovery path. No external email was sent during testing. Email delivery remains in demo capture mode.

## Keyboard use

Tab exposes the skip link and follows the page's normal control order. Enter/Space activates controls. Ctrl/Cmd + K opens search when another dialog is not open. Escape closes dialogs, including a populated search. Native FAQ disclosures respond to Enter/Space.

## Verification

The automated suite covers the controls above, all seeded roles, scoped search results, dark-theme pages, mobile overflow, selected axe accessibility checks, failure recovery, optional attribution, clipboard success/denial, and a generated A4 print PDF. See `docs/TESTING_REPORT.md` for the final run results and limits.
