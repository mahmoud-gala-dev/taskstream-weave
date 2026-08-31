# i18n Test Report

## Automated
- `bunx tsgo --noEmit` — clean (translation keys are typed via `MessageKey`, so a typo in a
  key is a compile error).
- SSR route checks: `/` 200, `/settings` 200, `/tasks` 200.
- Font/link injection verified in the rendered HTML head (Cairo stylesheet + preconnects).

## Arabic (ar)
| Check | Result |
| --- | --- |
| Navigation, dashboard, active work, search, tasks, topics, settings, global menu translated | Pass |
| `dir="rtl"` and `lang="ar"` on `<html>` | Pass |
| Cairo font applied to text, buttons, inputs and selects | Pass |
| Forms, selects, sidebar, context menus, sticky notes mirror correctly | Pass |
| Timers/percentages remain LTR and readable | Pass (intentional) |
| Mobile nav row and stat grid — no overflow or clipped text | Pass |

## English (en)
| Check | Result |
| --- | --- |
| All copy unchanged in wording | Pass |
| `dir="ltr"`, original font retained, layout identical | Pass |

## Regression
Authentication, routing, Firestore reads/writes, session timers, drag & drop, AI prompts,
notifications and demo data were not modified — the change set is presentation + i18n only.
Known follow-up: the dense workspace surfaces listed in
`02_REMAINING_HARDCODED_STRINGS.md` still render English copy.
