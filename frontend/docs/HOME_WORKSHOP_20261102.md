# Home and About workshop restoration — 2 November 2026

Implementation and verification in progress. This is not a publication receipt.

## Sources and reconciliation

The complete 1 November owner brief, its placement register, all 15 photographs
and Sheet1 of the authorised 28 October workbook were inspected. The originals
are 5616×3744 (portrait 3744×5616), rather than the reduced dimensions in the
brief. Sources remain unchanged in the owner directory and attachments. The
reproducible Sharp script produces 13 metadata-stripped WebP delivery images,
2,547,642 bytes total. Next Image supplies responsive delivery sizes.
`workshop-asset-manifest.json` retains every exact source name, SHA-256, actual
dimensions, placement and crop decision, including the two withheld illustrations.

The existing injector image was inspected: it is the graduated-cylinder tester
and cleaner. IMG_3258 is correctly used as the smoke leak detector. Both lift posts
and all seven people retain their natural photographic proportions. Blue uniforms,
vehicles and skin tones retain their original colours. The Castrol and green
performance-car composites are withheld. Shop discovery is explicitly illustrative,
without an invented SKU, price, stock, partnership or compatibility claim.

The clean checkout was fast-forwarded from f13af083 to e1ee52d2 before edits. The
baseline public deployment was dpl_A1QVEcajpqZYnHTiE4pC5GL47Cy6 on both domains
(www redirects to apex), source c44d7d68. Later concurrent releases must be
reconciled before promotion. No unrelated worktree changes are discarded.

## Service mapping and genuine outstanding decisions

Before authoring, the public API and signed-in administrator catalogue were both
inspected. All-services visibility showed exactly one record with no next page:
Tyre Change, 669f57ce-6e45-46f8-a9c4-75aa56f9d169, version 6, NGN 1,000, 30
minutes, tyre-wheel-maintenance. The eight existing owner groups were verified.
The older tracker’s NGN 1,000,000 note is superseded by the current 1 November
record. This task preserves the current record, identity, price and quantity scope.

| Offering                          | Sheet1 evidence                                                              | Parent / match                                                                                         | Amount handling                                                                |
| --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Comprehensive Vehicle Diagnostics | A18:B18, C18 10,000, D18 20%, E18 8,000; full health check + PDF scan        | No pre-existing record; Vehicle Diagnostics & Inspections                                              | Final amount 800,000 kobo; duration and warranty unconfirmed                   |
| Wheel Alignment                   | A5:B5, C5 5,000, D5 20%, E5 4,000; all four wheels; F5 1hr, G5 7 days        | Authored via reviewed admin workflow as 14e8ba81-1fc2-4057-ba50-99c15060aea2, Tyre & Wheel Maintenance | Final amount 400,000 kobo; 60 minutes; no second discount                      |
| Generic Lube Oil Service          | A23:B23, C23 10,000, D23 20%, E23 8,000; oil change + air/AC filter cleaning | No pre-existing record; Engine & Drive System Maintenance                                              | Final amount 800,000 kobo; distinct from Basic package row 24 (1,000,000 kobo) |

The current authoring contract requires a duration; nullable-duration authoring is
implemented so the missing cells can remain unknown. Diagnostics and generic oil
authoring await that compatible backend publication. No slot or capacity is added.
Home reads published catalogue prices as integer kobo and never re-applies D’s
discount. Exact name matching avoids reinterpreting a quick OBD scan, basic oil
package, a group or Tyre Change as a featured job. Missing or duplicate matches
keep a contextual enquiry without a made-up price or service ID.

Only the actual unresolved workbook facts remain: R20/R21 inclusion boundaries and
row 9’s repeated smaller-tyre description; equivalence of the existing tyre unit
to four-tyre packages; unnamed priced rows; named inspections without prices; Major
AC’s unchosen 5%/10% markup; undefined warranty conditions, durations and parts/
materials/VAT inclusion. These are not grounds to block the unambiguous Home
composition or to republish the whole workbook. No payment policy is activated.

## Behaviour and safety

The hero has deterministic first-slide HTML, a prioritised responsive photo and a
real CTA before JavaScript. Only its interaction is a client island. Controls are
progressively enhanced; one heading, one current link and no cloned focusable
slides. Rotation uses one six-second timer and a 500ms opacity transition. Hover,
manual/focus pause, explicit Play, reduced motion, offscreen/hidden suspension,
arrows, slide selection and touch share one state controller. Navigation resets
the reading interval. The current slide remains while another image decodes;
failed or eight-second-overdue images are skipped with at most three candidates.
All-failed photos retain copy and links. Mount listeners and timers clean up.

Patterns follow the [WAI carousel guidance](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/),
[web.dev carousel guidance](https://web.dev/articles/carousel-best-practices) and
[LCP guidance](https://web.dev/articles/optimize-lcp). The installed Next image and
server/client documentation was inspected. No new dependency, profile or worktree.

Before/after captures contain public pages only. The anonymous baseline used Edge
headless, fresh browser contexts, 390/1440×1000, reduced motion, network idle, no
CPU/network throttling. Baseline single-run Home LCP was 4272/1656ms; CLS
0/0.000477; measured image transfer 101440/203918 bytes. About LCP 1556/1288ms,
CLS 0.000004/0.000166, image transfer 0/59152 bytes. Zero page errors. The zero
transfer sample can reflect cache accounting, not zero image payload. These are
lab samples, not field percentiles; production after measurements remain pending.
Raw baseline and safe screenshots: Windows Temp `allied-home-20261102`.

The first production-like build (reused Next 16.3.8) and type check passed; the
lockfile’s Next 16.4.3 requires exact-source CI. Focused frontend checks pass 18
tests, including four StrictMode loops and timer cleanup; scoped lint passes.
Backend schema and public-corpus checks pass 13 tests. An initial nested-act test
and a direct hydration-state update were corrected. A temporary OpenAPI metadata
extension failed outside the generator; supported Zod metadata resolves it.

Automatic approval review rejected starting the local production server with only
“blocked by policy”. No equivalent server command was attempted. The approved
hosted-candidate workflow will provide production-like rendered verification.
Real-time loops, full requested interaction/loading matrix, screenshots, final
regressions, exact-source CI and publication are still required. Physical phones
and full screen-reader acceptance are not available and will not be claimed.

## Adjacent owner question

Source inspection confirms Admin/Super Admin can edit vehicle records subject to
fresh versions/MFA and current access. Asking-price changes additionally require
a StaffProfile for price history, even for Super Admin; the owner’s actual profile
has not been verified. The positive-NGN parser also rejects comma separators. A
stale/unconfirmed mutation can lock editing until current state is explicitly
reloaded. These are diagnostic findings, not proof of the owner’s exact failure.
No vehicle, price, staff profile or permission was changed for this question.
