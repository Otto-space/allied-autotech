# Public launch decisions — updated 22 October 2026

Authority: Mike's explicit answers in this conversation, relaying the business's
instructions. These records do not publish transactional policies or enable
payments, marketing, destructive retention, or financial account permissions.

## Customer care: confirmed

- Business/legal name supplied: Allied Autotech Limited. Brand: Allied AutoTech.
- Monitored contact: support@alliedautotech.com; phone/WhatsApp 08136075567.
- Primary responsible person: Operations Supervisor, Newworld Orlu, until a
  customer-care officer is appointed.
- Address: 133 Stadium Road, beside Kilimanjaro, Port Harcourt, unchanged.
- Customer-care hours: Monday–Saturday, 8am–6pm, Nigeria time.
- Target: initial acknowledgement within 30 minutes during those hours. Outside
  those hours: within 30 minutes of the next opening. This is a response target,
  not a promise to resolve every issue within 30 minutes. Mike explicitly approved
  this interpretation in a separate answer.
- Michael Enoch was mentioned as a **possible** virtual/technical customer-care
  officer. Backup assignment remains unconfirmed. Do not grant access, invite an
  account or publish a personal responsibility based on “Maybe”.
- This confirms public contact details and the response target. It does not define
  urgent complaint classes, public-holiday exceptions, payment-dispute coverage,
  a complete complaint policy, invoice identity/tax metadata or a privacy notice.

## Enquiry data handling: confirmed

Mike explicitly approved: Allied Autotech Limited uses submitted contact details
and messages to respond and manage the request. Access is limited to authorised
staff and necessary hosting/email providers: DigitalOcean, Vercel, Google
Workspace and Resend. Provider processing can occur outside Nigeria, including
the London backend. Newworld Orlu handles privacy/correction/deletion requests
through support@alliedautotech.com. Enquiry details are not used for marketing.

This is approval of these business instructions only. Complete notice wording,
remaining record-type retention periods and transfer safeguards still require
review before public form intake; it does not assert that consent alone
establishes lawful transfer or authorise automated deletion.

## Ordinary closed enquiry retention: confirmed 22 October 2026

Mike explicitly selected **12 months after closure** for the name, contact details
and messages of an ordinary enquiry that closes without a sale, booking or
complaint. Closure is the starting event, not submission or the first response.

This approves the rule for the draft retention schedule only. It does not enable
automatic deletion, approve a blanket purge, set retention for transactions or
complaints, or override a legal hold. Reopened enquiries, holds, backup expiry
and operational deletion/anonymisation procedures still need to be defined
before enforcement. The exact public notice must reflect the reviewed schedule.

## Support mailbox acceptance: confirmed 22 October 2026

The owner confirmed that a message sent from another existing controlled email
account reached the Support Google Group and that the reply arrived at that
account from `support@alliedautotech.com`. This passes the owner-operated
external receiving and branded replying check; no password or message contents
were requested or recorded.

The website enquiry email acceptance check also passed by owner confirmation:
the alert reached Support, its received Reply-To matched the submitted customer
address, and the customer received the reply from `support@alliedautotech.com`.
Groups' Post replies to is set to Sender chooses recipient. The working staff
procedure is Reply all with `support@alliedautotech.com` as From and To and the
customer's submitted email in Cc. The owner confirmed customer receipt with this
arrangement after reporting that Groups would only place the customer in Cc.
There is no requirement to move the customer to To. Remove the notification
sender from additional recipients if present, and check all recipients before
sending. Reply to author selected the notification sender in the observed
interface.

The owner also confirmed finding and opening Website Enquiry Check in the
production staff dashboard. The tested enquiry workflow is accepted. Fresh
authentication-header results and other staff-role access were not verified
by this check. This workflow acceptance does not approve
privacy wording or enable public access automatically. Do not ask for another
submission merely to reconfirm the completed email workflow.

## Previously confirmed VAT and quotations

Advertised prices exclude VAT; add 7.5% after discounts to products/services and
both delivery types, showing delivery VAT explicitly. The external courier fee's
collector is still unanswered. Seven-day quotation validity is already recorded.
Do not ask the owner to repeat these settled instructions.

## Still awaiting specific approval

1. Delivery zones, fees, timing and who collects external courier charges.
2. Complete vehicle reservation agreement and its publication/version evidence;
   deposit/hold/balance/late-confirmation/cancellation/refund rules. Draft 70% and
   two-hour settings remain unapproved.
3. Order cancellation/return calculation boundaries, partial quantities, return
   window anchor and defective-item handling.
4. Bank refund clock: starting event, counting rule, working days and holidays.
5. Finance publication: invoice metadata, tax identifiers where applicable,
   rounding, payment terms and approval provenance; VAT instructions above stand.
6. Actual distinct refund request/approve/transfer/check accounts, each verified
   and assigned through the authorized capability workflow.
7. Workshop branch calendars, capacity, resource review and confirmation coverage.
   Customer-care hours are not automatically workshop capacity authorization.
8. Complaint/dispute urgent classes, escalation backup, holidays and actual
   provider-dashboard responders. Newworld's customer-care responsibility does
   not automatically assign every financial/dispute permission.
9. Marketing consent wording/version, sender, content and unsubscribe operation.
10. Remaining retention rules by record type, legal basis, start event and holds.
    Ordinary enquiries that close without a sale, booking or complaint have the
    approved 12-month rule above. No blanket purge or automated deletion is approved.

Before public enquiry intake, review the exact public customer-care/privacy text
and complete the remaining launch checks. The standalone mailbox and website
enquiry workflow, including owner-dashboard visibility, have passed as recorded
above. Checkout, paid
reservations and live payments remain disabled under the approved launch scope.


## Catalogue fallback approved ? 22 October 2026

The owner requested public access tonight and approved a catalogue-only fallback: public services, products, vehicles and direct phone/email/WhatsApp contact. Website enquiry/complaint intake, customer registration/dashboard functions, checkout, reservations and live payments remain unavailable. Staff authentication and MFA remain required.

The user approved the catalogue privacy wording in `frontend/app/privacy/page.tsx` on 22 October 2026. At the user?s request, the public notice uses ?website hosting, cloud storage and email service providers?; named-provider records remain internal. This approval does not close the broader provider/overseas-processing review or authorise website customer intake. No additional purchase is authorised.

Implementation and deployment verification are in progress; this entry is not evidence that public cutover has occurred. BitLocker was last reported by the user at 51%; completion has not been verified.


## Public catalogue release verified ? 22 October 2026

Public access is enabled at https://alliedautotech.com and the www address. Anonymous desktop/mobile browser checks passed for contact/privacy pages, external contact links, the real Tyre Change listing and its image, closed registration/customer routes, staff sign-in visibility, frontend API restrictions and robots indexing. No account password or MFA secret was used during these checks. The public privacy notice uses the owner-approved provider categories.

- Frontend release source: 52aa7ccc (application changes through 8ecd6ff3); final Vercel deployment: dpl_Dv9hzGSbyrtgdxgzV3G2kD5BGxgB.
- Backend source: 454fbeb9; active deployment: 1b68cadd-9e93-49bb-9bd8-8d489c655e59.
- Production settings: catalogue mode, private perimeter disabled, search indexing enabled. Staff authentication/MFA and authorisation remain enabled.
- Registration, website enquiry/complaint submission, customer dashboard APIs, checkout, reservations and live payments remain unavailable. Full privacy/provider review and the remaining transaction policies are still outstanding.
- Validation: 53 backend launch-boundary unit tests; 68 frontend unit tests; backend/frontend TypeScript checks; changed-frontend-file lint; four Docker targets; Vercel production build; hosted protected and fresh anonymous browser checks. Local e2e runs could not complete because of cold-server/compilation timeouts; hosted checks supplied the release browser evidence. Final anonymous verification found cached CSS referencing fonts on an older protected deployment. A fresh Vercel build without reused build cache fixed those references. Repeated anonymous desktop/mobile browser checks passed with both custom fonts loaded, real service media visible, no HTTP authentication challenges and no page errors.
- Both rollout pre-deployment jobs ran the read-only database safety check and confirmed compatible migration history/schema with no database changes. Schema/migration sources are unchanged from the prior release.
- Rechecked the managed off-device backup dated 2026-10-22T05:22:09Z, application-only database firewall, exact production database host/port/name and restricted runtime/migrator roles. Reused the verified separate managed restore rehearsal and the support-timeline isolated 60-to-61 migration rehearsal (84 restored tables, source database not written); no new restore cluster or rehearsal was purchased/run for this schema-unchanged release. Existing provider encryption/retention/PITR evidence remains in the deployment records.
- No database reset, replacement, migration, business-record deletion, resource resizing or new resource purchase occurred. Negative API checks submitted empty bodies only to routes already proven closed.

Private deployment receipts are in backend/ops/digitalocean/.private/production/ under catalogue-* in the original Desktop checkout. Do not publish those files. Deployment completion does not imply zero operational risk or completion of the broader privacy review. BitLocker completion remains unverified; its last user-reported state was 51%.

Rollback if needed: promote the protected catalogue frontend dpl_AYt7TtCfsDzuCBnjce1wdDxCquf5, and restore only the API private-testing flag after checking current provider state. Preserve database contents, immutable images, credentials and component sizes; do not restore an old full spec blindly.

When changing the private/public boundary, build the Vercel release with `--force` without `--with-cache`, and verify CSS font asset deployment references in an unauthenticated browser. A successful page response alone does not prove that subresources are public.
