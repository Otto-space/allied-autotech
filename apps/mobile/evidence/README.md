# Android emulator evidence

Medium_Phone AVD, Android 37, 1080×2400, Expo Go SDK 58. No physical-device or
iOS acceptance. No production endpoint or real customer record was used.

- `android-*-mocked.png`: five initial normal-text tabs; the initial Home and
  Explore show genuine request-timeout states while the host route was unavailable.
- `android-navigation-200-percent.png`: clean inspected adaptive bottom navigation.
- `android-*-200-percent.png` and paired XML: five final large-text tabs after
  the two-row navigation fix; some show Expo Go's transient Refreshing banner.
  Explore's empty response and Home's unavailable snapshot came from the local
  loopback fixture via ADB reverse, not the real application backend.
- `android-initial-*`: retained ANR, bundling and original wrapping findings.
- `android-window.xml`: last transient UI dump, not a separate acceptance result.
- `android-approved-reload.png` and `android-approved-reload-explore.png`, with
  paired XML: successful fresh post-install reload against only the loopback
  fixture. Metro session 50683 received exactly lowercase `r` without Enter and
  completed the Android bundle. Home rendered signed-out and unavailable;
  Explore rendered the empty service response. The initial launcher ANR is
  retained in `android-approved-reload-initial-launcher-anr.*`.
- `android-reload-9370.png` and `android-reload-9370-explore.png`, with paired
  XML: latest successful local-only reload. The 22 GiB preflight passed with
  25.23 GiB free. Metro session 9370 received exactly lowercase `r` without Enter;
  the Android bundle completed in 342 ms, Home rendered the capability fallback,
  and Explore rendered the empty fixture. Two emulator system dialogs recovered
  using Wait. Task-created processes and forwarding were cleaned up; Android was
  not restarted for final scaffold closure.

The large-text capture run asserts each heading after scrolling to the top and
asserts Explore's empty response. Home's retained scroll position caused an
earlier harness failure; the assertion remained intact. Full screen-reader,
physical-device and external-keyboard acceptance remain unverified. Fresh
post-install launch/reload is now verified with local fixtures only.
The original font scale (1.0) was restored and the task emulator stopped without
saving a snapshot. See ../SCAFFOLD_REPORT.md for checks, failures and limitations.
