# UI/UX improvement record (in progress)

The live anonymous checks on 23 October 2026 found a usable 320px header, primary pages, Help search and auth deep link, with no horizontal overflow on the checked pages. Preserve these behaviors while improving specific workflows.

| Priority | Improvement                                                                              | Evidence / acceptance                                                                                                                                                               |
| -------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | Retain direct recovery from legacy `/shop` links.                                        | Live redirect to `/parts` works; verify dashboard card and browser Back behavior in authenticated testing.                                                                          |
| P2       | Reduce redundant anonymous session probes and expected 401 console noise.                | Trace which shared components call `/auth/session`; retain fail-closed private access and test public/auth transitions.                                                             |
| P2       | Check fixed support actions against focused fields and on-screen keyboards at 320–414px. | The 320px Help screenshot shows fixed Help/WhatsApp actions; no obstruction was established in the initial viewport. Test scroll, focus and keyboard states before altering layout. |
| P2       | Complete keyboard, screen reader and intermediate-width checks.                          | Initial snapshots show skip link, named mobile navigation, Help search and a pause control for motion; interaction and announcement behavior still need testing.                    |
| P3       | Review font and CSS preload warnings after performance measurement.                      | Browser reported preload warnings on some routes. Measure before changing loading strategy.                                                                                         |

Do not add imaginary inventory, appointment capacity, reviews or availability to make empty states look full. No visual redesign or production deployment is proposed by this initial record.

The published Tyre Change service detail was reviewed at 390px. Its enquiry guidance now fits routine maintenance as well as diagnostic work. This is a small copy correction in the existing design, with no new booking or capacity promise.

The Parts guidance now matches the public enquiry journey: visitors are told to check fitment and ask staff to confirm branch availability, without implying a cart reserves stock. Full-mode purchase and cart guidance is retained for the approved future transactional flow. The advanced-filter fitment note is neutral in either mode.
