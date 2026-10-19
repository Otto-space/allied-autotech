# Workshop privacy review — gate 78

Route `/admin/privacy`. Locally accepted 18 October 2026. This is one global queue
with inline request review and account retention holds; no separate detail route
exists. Customer intake/history retains its separately accepted behavior.

## Implemented behavior

A named breadcrumb/header, compact review-only guidance and grouped supported
filters replace the generic nested page. Request kind, status and exact account
reference now use compatible backend filters. Complete request cards show full
request/account UUIDs, exact Lagos creation/review timestamps, original explanation
and the customer-visible response. Cursor/filter/selection state survives reload
and browser Back. Page-local counts do not imply global totals.

One expanded workspace groups customer response and account protections in adjacent
desktop panels, stacked in the same reading/tab order on mobile. Active/released
holds show their full reference, reason, optional record reference and precise
dates. The latest 100 boundary is explicit; approval still checks all active holds
and unresolved disputes on the server. Creating or releasing a hold does not delete
data. Approval remains **Approved, awaiting policy**, with no destructive execution.

Every Staff, Admin and Super Admin needs active PRIVACY_REVIEW and verified MFA.
Current own identity/capability gates private reads and write preflight. Strict
filtered pages and account hold validation preserve scope; denied reads clear the
protected workspace. Temporary failures retain labelled facts with changes blocked.

One parent single-flight/review guard coordinates review, hold creation and release.
Fresh actor/current filtered page/account protections precede writes. A changed or
moved request stops preflight safely; no unsupported direct request API is invented.
Exact saved body/scope, monotonic reviewedAt and the audited release justification
are validated. Response fields remain mounted after review changes and require
explicit reload before another reviewed decision. Only the confirmed form's scoped
draft is cleared, preserving unrelated response/hold fields.

Minimal actor/role/request/account/operation markers retain uncertain outcomes through
reload; session invalidation redacts marker values while keeping the lock. Explicit
**Load current privacy records** reads current queue/account protection, replaces
page drafts and never resends or proves the original request outcome. Definite
rejection differs from an unsent preflight. Customer recovery remains unchanged.

Backend changes add compatible staff filters, minimal private READ audits, deterministic
hold ordering, an account lock shared by retention changes/privacy approval and
one-audit release behavior with an exact scoped release receipt. OpenAPI and generated
types are updated. No endpoint, permission, schema or migration change is needed.
See the [contract and remaining capabilities](../../../backend/docs/workshop-privacy-review.md).

## Concepts and fidelity

1440px/430px baseline captures were viewed before fresh built-in Image Gen
[desktop](work-privacy-oct-concepts/desktop.png) and
[mobile](work-privacy-oct-concepts/mobile.png) concepts. Both concepts were viewed
before UI edits. [Audit](work-privacy-oct-concepts/audit.md),
[specification/corrections](work-privacy-oct-concepts/spec.md) and
[exact prompts](work-privacy-oct-concepts/prompts.md) are saved. Browser plugin tools
were unavailable, so production Next.js, Playwright/Edge, Axe and native `view_image`
comparisons were used. Generated imagery is not embedded in the application.

Native concept/final comparisons use **1486 × 1058 desktop** and **875 × 1797 mobile
reference**. Separate 320/375/430px checks verify narrow layouts; full-page images
retain continuation rather than dropping facts/forms to fit the reference canvas.

| Point             | Final disposition                                                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition       | Named header, grouped filters, full request cards and one adjacent response/protection workspace follow the references with the actual Allied shell.             |
| Typography        | Computed Quicksand, 30px wide/24px narrow title, 18px request/14px nested section hierarchy and 13px body/controls retain a compact readable workshop hierarchy. |
| Palette           | Cool canvas, white 12px panels, restrained red actions, neutral recorded statuses and amber active protection match the intended treatment.                      |
| Facts             | Full UUIDs, exact Lagos milliseconds, honest Not reviewed and actual explanations/responses replace generated short IDs, dates and invented account names.       |
| Operations        | Only DELETION/ANONYMIZATION and actual review statuses are used; generated correction/consent cases and fabricated completed updates are excluded.               |
| Holds             | Latest 100 wording, documented release justification and actual 2,000-character limits replace omitted release controls and the generated 1,000-character limit. |
| Responsive/review | Complete wrapping labels/references, ≥44px controls, consistent reading/tab order and full-body mobile review remain usable at 320px.                            |

Copy preserves **Privacy review**, **Review decisions only**, **Request type**,
**Review status**, **Account reference**, **Requests for review**, **Customer-visible
review response**, **Retention holds**, **Release justification**, **Reload response
fields** and **Load current privacy records**. No claim of deletion, anonymization,
provider delivery or proven original-request recovery is made.

## Verification

- **31 distinct production browser cases pass:** 27 new queue/workspace cases and
  four existing staff review/hold, customer ownership paging, duplicate explanation
  and trimmed hold-validation regressions. They cover all three staff roles with/
  without capability, identity gates, persistent 25+3 paging/selection, exact filters,
  complete writes, stale drafts, revoked permission, three uncertain operations,
  malformed/wrong-account responses, rate limiting and denied reads.
- **Six helper units** pass for strict queries/cursors/filter pages, account holds,
  full exact review/hold/release receipts, minimal scoped pending markers/redaction,
  isolated draft removal and blocked recovery storage.
- **Five new API/database scenarios** pass for filtered 25+3 paging, exact dates,
  private headers/minimal read audits, capability/role boundaries, review CAS,
  concurrent once-only release, an explicit held-account-lock protection/approval
  race and an older active hold outside the displayed 100 still blocking approval.
- Frontend/backend type checks, scoped ESLint/oxlint, formatting, OpenAPI validation
  for 270 paths and the final production build pass. **21 exact frontend source/
  dependency hashes** match the tested production snapshot. Development corrections
  preceded the single final production build.
- **20 final new-page Axe scans:** seven widths 320/375/430/768/1024/1440/1920,
  full mobile review and 12 native/state captures. Captures include Staff, empty,
  outage, profile error, no grant, long text, full review, released hold and pending
  outcome. No horizontal overflow or captured page errors occurred.
- Connected production Edge/Express/PostgreSQL verifies **25+3 reloadable paging/
  Back**, combined filters and retained selection. Five intentional UI mutation
  requests produce **four successful changes/four mutation audits** and one valid
  hold-blocked approval. Exact release justification, approval without deletion,
  precise monotonic reviewedAt and a committed lost review saved once without replay
  pass. There are **35 privileged READ audits**. A foreign request's complete hash
  remains unchanged; capability revocation clears private facts and Customer/
  anonymous boundaries pass.

The first development write failures were traced to the new fixture omitting the
CSRF response, before POST dispatch. The fixture was corrected, temporary diagnostics
removed, and focused write checks passed before final production verification. Native
captures found a skipped hold heading level, corrected before the production build.
The initial real helper omitted a required synthetic customer phone; it stopped
before creating requests. The corrected continuation reused the already created
synthetic reviewers/grants rather than recreating them.

## Safety and remaining work

Actual **127.0.0.1:55480 / allied_work_aftercare_20261017_test**, isolated-test
environment and existing restricted runtime credentials were verified before fixture
writes. Existing owners/grants were preserved; only new fixture reviewer grants were
used/revoked. Synthetic records remain; only owned sessions were removed. No
application/shared database, schema, migration, existing grant, backup/restore, push
or deployment operation occurred. Unchanged 59-migration replay/db:check/runtime
privilege evidence was reused; no new restore test is claimed.

ADM-33 records implemented privacy discovery/lifecycle corrections. ADM-34 records
optional durable staff recovery. ADM-35 records full hold-history management beyond
the existing latest 100 projection. Actual destructive execution remains separately
dependent on approved retention policy. Next separate page: review moderation
`/admin/reviews`. Finance, organisation, deployed and application-wide acceptance
remain open. The overall goal remains active.

Evidence: `C:/Users/PC/.codex/work-privacy-` production browser/legacy/API/build/
real/capture logs, unit/real/captures/source-hashes JSON and final PNGs. Development and
baseline evidence remains separate; temporary helpers stay outside the repository.
