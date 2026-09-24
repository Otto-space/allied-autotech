# Dashboard form UI review — 24 September 2026

Shared presentation now covers CUSTOMER, STAFF, ADMIN and SUPER_ADMIN dashboards.
Changes include visible field borders, consistent labels and button typography,
keyboard focus, invalid/disabled/read-only states, larger textareas, file controls,
form grouping and narrow-screen layouts. Profile and vehicle forms have clearer
sections; quotation notes use a multiline control. Submission contracts and
authorization checks were preserved.

## Visual review

Reference concept:
`C:/Users/PC/.codex/generated_images/01a0d2ec-73e4-7cb0-97ab-71cdecc99d80/exec-2d7fe106-13fd-4a7d-8e3b-df706caf656e.png`

Real browser captures used the existing Playwright configuration with headless
Microsoft Edge; no Browser/IAB tool was available. The reference is a 1536×1024
composite of desktop and phone views, not a single browser viewport. Actual
checks covered 1440×1080 and 1280×900 desktop viewports, and 320, 390 and 768px
widths. `view_image` was used to compare the concept and rendered screenshots,
including the final quotation spacing refinement.

Screenshots are in `C:/Users/PC/AppData/Local/Temp/`:

- `allied-forms-profile-desktop.png`
- `allied-forms-profile-mobile.png`
- `allied-forms-admin-service.png`
- `allied-forms-super_admin-service.png`
- `allied-quotation-editor-mobile.png`

| Comparison        | Evidence and decision                                                                                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grouping          | Concept separates personal details and address; profile now uses named fieldsets and a divider. Vehicles similarly separate required and optional details.                                                |
| Fields            | Concept has outlined controls with generous height; rendered controls are at least 46px high with explicit 16px text. Plain inputs previously missed the shared styles.                                   |
| Focus             | Concept shows a blue halo; implementation uses the existing navy palette with a solid outline and pale halo, confirmed with keyboard navigation.                                                          |
| Typography        | Labels and buttons use sentence case, with separate heading, label and hint sizes. Existing site font and branding are retained intentionally.                                                            |
| Surfaces          | White forms sit on a pale gray dashboard background with restrained borders, rounded corners and consistent padding.                                                                                      |
| Actions           | Save/review actions have clear spacing and comfortable hit targets. Mobile footer buttons expand to the available width.                                                                                  |
| Responsive layout | Desktop pairs suitable fields; narrow layouts stack fields. City and state also stack on mobile, intentionally improving on the concept's compact pair. No horizontal overflow occurred in checked forms. |
| Quotation details | Screenshot review exposed missing padding around line items; the broad fieldset reset was narrowed and remove-line targets enlarged. The revised screenshot and workflow were rechecked.                  |

Above-the-fold copy was checked: the profile keeps “Your profile” and adds the
concept's “Keep your contact details up to date.” The redundant “Customer details”
eyebrow was removed. “Refresh profile” remains available alongside the heading.
Existing navigation, support controls and account identity are retained. Nigerian
fixtures and the Nigeria country note intentionally replace the concept's invented
Australian sample data. The generated logo/navigation are not substituted for
the application's existing components.

The form treatment was verified against the reference with these intentional
adaptations. No unresolved clipping or overflow was observed in the inspected
form surfaces. Fixed support controls and the Next.js development badge can
appear midway through full-page screenshots because they stay in the viewport.

## Functional verification

- Four new browser tests passed: customer profile validation/save and keyboard
  focus, customer vehicle validation/save, and ADMIN/SUPER_ADMIN service pricing,
  checkbox state and explicit review before saving. Automated accessibility scans
  passed in these cases.
- Five appointment-slot tests passed across staff, admin and super admin, including
  missing-profile restrictions, publish/close confirmations and uncertain outcomes.
- Five further tests passed: manual-payment review/cancellation, quotation editing
  and revision handling, customer enquiry creation, and internal/customer staff
  replies. The quotation test passed again after the final spacing refinement.
- Financial-policy and security tests completed their form assertions, but failed
  their final clean-console checks because the local Console Ninja instrumentation
  attempted a websocket connection blocked by the site's CSP. Security-page and
  dialog accessibility scans passed. CSP and those existing tests were not weakened.
- The optional signed-file-upload test was skipped by its existing environment
  guard; an isolated approved storage host was not configured.
- Frontend TypeScript, targeted ESLint and formatting checks passed.
- Production build and standalone asset preparation passed. Compiled CSS was
  checked to include the final quotation padding and tap-target refinements.

Browser writes used intercepted synthetic API responses, not real customer or
financial records. These are representative cross-role checks, not a claim that
every dashboard route or external storage integration was exercised.
