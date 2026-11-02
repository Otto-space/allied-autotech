# Appointment date, countdown and optional browser alerts - 2 November 2026

The previous goal turn published search/focus/static-image delivery and is progress.
This batch implements further explicit requirements from the same complete brief.
The source baseline is 23dbaa7c; live runtime remains 27bf3559 until release gates
and final hosted checks pass. The full objective remains active in the quality
register. Browser plugin not available; use existing Playwright with Microsoft Edge.
All account and booking records in rendered tests are isolated synthetic fixtures.

The flow under test is dashboard -> optional invitation -> existing notification
settings, with no permission prompt until the user explicitly chooses Enable.
The invitation is dismissible per account/tab, absent when unsupported, unavailable,
blocked, offline or already verified, and waits for current managed-workforce
access. Settings deep links open the existing panel and focus its real heading.
Device registration, CSRF, server confirmation and sign-out/expiry semantics are
unchanged. The invitation performs only protected reads. Current customer care
precedes optional alerts; native inbox access remains available.

Booking details and the next-booking dashboard card share a Nigeria-time date
indicator and confirmed-future-only countdown. Requested times retain explicit
confirmation wording. Countdown expiry never changes status or starts work.
Current-data errors/refresh suppress the countdown; absolute dates remain. Timers
refresh on focus/visibility, clean up on unmount and use aria-live=off so every
update is not announced. Existing cancellation/rescheduling, quotations, money,
permissions, launch flags and published hero behavior remain intact.

Service-request v14, its focused and isolated HTTP expectations and the Help
checkpoint are versioned together. The public gate and guide targets stay the
same; no new private content or permission is published through Help.

## Verification in progress

- Four baseline captures passed on the actual current public artifact with
  synthetic overview/booking interception; no application session was copied.
- Final focused frontend units: 20 passed, including unknown-time preservation. Backend learning/retrieval: 12 passed.
  Final types, scoped ESLint and formatting passed before committing. Existing verified dependencies are reused.
- Initial local 38-case browser run: 35 passed, two real countdown contrast failures
  and one garage-navigation timeout. Countdown now inherits its containing card
  colour; corrected summaries and four booking accessibility widths passed in a
  10-case recovery run including existing explicit opt-in/CSRF/device opt-out.
  Garage navigation then passed unchanged; its original timeout cause is not established.
  A separate final 12-case run passed the moved invitation in all four roles at
  320/1440, two managed Staff cases with held/current scope and keyboard dismissal.
  Those are separate runs, not a single clean initial pass.
- An initial added unit run had 18 passed / one failure because a preceding test
  retained the account/tab dismissal. Reset test storage before each case; full
  affected set then passed 19. Runtime dismissal remains durable within the tab.

Protected/source/fixture/hosted/actual-account/device evidence will be reported
separately. Exact-source CI, packaged backend, held frontend, final publication
and real-account/device acceptance are not inferred from these local checks.
No real booking, message, price, customer, vehicle, stock or provider permission
was changed. The full objective remains incomplete.

Evidence directory: C:/Users/PC/AppData/Local/Temp/site-completion-20261102.
Reports: appointments-before.json, appointments-local.json,
appointments-recovery.json and appointments-final.json. Safe baseline screenshots
are in appointments-before; corrected date/countdown screenshots are in
appointments-recovery. Original failed reports/traces are retained.
