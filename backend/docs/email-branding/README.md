# Allied AutoTech email branding

Scope: every Allied AutoTech Google Group, app notification email and account email. Sender identity remains `notifications@notify.alliedautotech.com` through Resend.

Open `index.html` to review ten HTML designs. Plain-text counterparts and a text-only Google Groups footer are included. Regenerate with `npx tsx scripts/export-brand-emails.ts` from `backend/`.

The application uses the shared renderer for verification, password resets, administrator invitations, notifications, support replies/status updates and department intake. Untrusted text is escaped, actions come from application-owned URLs, and each message includes a readable text version. Registered customers receive a sign-in link instead of private conversation content in email. Replies and status changes retain distinct subjects and copy.

## Resend

`resend-drafts.json` contains provider draft copies for design review. They are not a replacement for the application's typed, dynamically rendered messages. In particular, preview authentication links contain no tokens and must never be sent as account actions. Creating drafts sends no email. Do not publish or wire generic previews into authentication delivery.

The production sending-only key may not manage templates. Use an authorised Resend template-management session or a temporary management key kept outside the repository; revoke it after importing. Never paste credentials into chat or broaden the runtime sending key.

## Every Google Group

Inventory all domain groups through the authorised Groups administrator account before applying changes. Do not assume the three app routing addresses are the complete inventory. Record each group and the existing footer/welcome/automatic-response text privately; apply only branding changes and verify each group afterwards.

- Apply `google-groups-footer.txt` to each group's custom footer. Google supports text only here; retain Google's own subscription/removal footer.
- Use `group-welcome.txt` for welcome text, adapting the group name and purpose without exposing membership.
- Use `group-acknowledgement.txt` to brand automatic replies that are already enabled. Do not turn on new responders or change recipients/delivery rules merely to apply branding.
- Use `group-reply.html` as a Gmail saved template when staff send from an authorised group alias. Replace the bracketed response before sending. Groups cannot centrally force an HTML wrapper on every message a member sends.
- Preserve membership, owners, posting permissions, visibility, moderation, reply routing, subscriptions, DNS and authentication records.

Sources: [Google Groups settings](https://support.google.com/groups/answer/2464926?hl=en), [Resend template creation](https://resend.com/docs/api-reference/templates/create-template).

Provider-side status must be recorded separately from these local files. No message sending or mass mailing is part of this change.
