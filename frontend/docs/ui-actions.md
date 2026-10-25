# Task actions

`app/components/action.tsx` builds on the existing `.button` brand styles. Migrate
consumers during a verified journey change; do not replace every control at once.

| Component / variant                 | Purpose                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| `ActionButton` / `primary`          | Main task action; explicitly set `type="submit"` for forms         |
| `ActionButton` / `secondary`        | Refresh, retry, cancel and other supporting actions                |
| `ActionButton` / `tertiary`         | Quiet utility action with an underline and a usable target         |
| `ActionButton` / `danger`           | Authorised destructive action; keep its existing review safeguards |
| `ActionLink` / `navigation`         | Underlined navigation with native link behaviour                   |
| `ActionLink` / primary or secondary | Navigation that deserves button-level emphasis                     |
| `SelectionButton` / `selected` prop | Persistent toggle state using `aria-pressed`, fill and inset edge  |

All variants retain native semantics and visible keyboard focus. Buttons default
to `type="button"` to avoid accidental form submission. Pass existing disabled,
pending and accessible-description props through. Loading labels must explain the
work, and failures must remain near the task. Selection buttons suit independent
toggles; exclusive form choices use native radio groups, as in support audience.

Ordinary prose links stay ordinary links. Do not apply `.button` to every anchor,
use anchors without destinations, or use a button to imitate navigation. A selected
navigation item still uses `aria-current`, not `aria-pressed`. The native-control
census in `ui-quality-inventory.json` is a review queue, not a list of defects.

Initial verified consumers: saved-parts vehicle actions, policy contact refresh,
and support reply review. Existing marketing controls and unrelated dashboard
variants retain their current styles. Review adjacent consumers before extending
this component's styles or migrating another page.
