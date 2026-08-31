# i18n Summary

- i18n system: custom lightweight dictionary layer at `src/lib/i18n.tsx` (no new dependency).
  `useT()` / `useI18n()` read the language from the existing user settings document.
- Translation files: `src/lib/i18n.tsx` (`messages.en`, `messages.ar`), keys are dot-paths
  (`common.*`, `nav.*`, `auth.*`, `dashboard.*`, `status.*`, `active.*`, `search.*`, `kind.*`,
  `tasks.*`, `topics.*`, `library.*`, `settings.*`, `menu.*`, `color.*`).
- Language persistence: existing per-user `settings.language` document in Firestore
  (unchanged storage — no new mechanism added).
- RTL/LTR: `SettingsProvider` sets `document.documentElement.lang` and `dir`
  (`ar` -> `rtl`, `en` -> `ltr`). Layouts already use logical properties (`me-*`, `text-end`).
- Arabic font: **Cairo** from Google Fonts, loaded with `<link>` entries in the root route
  `head()` (`src/routes/__root.tsx`) plus preconnects; applied via
  `html[lang="ar"] { font-family: "Cairo", ... }` in `src/styles.css`.
  English keeps the existing project font unchanged.
- Language switcher: Settings -> "Language & direction" select, and the global right-click
  menu toggle (Arabic/English). Both update text, direction and font instantly.
- Numbers/dates: `useI18n().formatNumber` / `formatDate` use `Intl` with `ar-EG` / `en-US`.
  Durations stay `dir="ltr"` monospace on purpose.

## Counts

- Strings collected in the audit: 168 user-facing strings across 14 files.
- Strings moved into translation keys: 148 keys (en + ar = 296 translated values).
- Screens/components updated: 10 (`app-shell`, `auth`, dashboard `index`, `active`,
  `search`, `tasks`, `topics`, `item-library`, `settings`, `global-context-menu`,
  plus `__root` and `styles.css` for font/direction).
- Remaining untranslated user-facing strings: see `02_REMAINING_HARDCODED_STRINGS.md`
  (tables workspace, item detail tabs, focus table, optimizer/assistant/documentation pages).

## Test results

- `bunx tsgo --noEmit`: clean.
- `/`, `/settings`, `/tasks` return HTTP 200 after the change (SSR unaffected).
- Arabic: text translated, `dir="rtl"` applied at document level, Cairo font active,
  forms/selects/menus mirror correctly, no overflow observed in the sidebar or stat grid.
- English: unchanged design, `dir="ltr"`, original font retained.
- No business logic, Firestore schema, API field, AI prompt, or auth flow was modified.
