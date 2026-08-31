# Hardcoded Strings Audit (Phase 1-2)

Scan scope: `src/routes/**`, `src/components/**`, `src/lib/**` (JS/TS/TSX/JSON),
server functions and validation/error messages.

Not translated by design: variable/function names, Firestore collection and field names,
enum values (`todo`, `in_progress`, `task`, `topic`), model IDs, URLs, AI system prompts,
internal logs, MCP/OAuth identifiers.

| Current Text | File | Context | User-facing | Translate? | Key |
| --- | --- | --- | --- | --- | --- |
| Dashboard / Tables / Focus / Assistant / AI Optimizer / Active work / Tasks / Topics / Documentation / Search / Settings | src/components/app-shell.tsx, src/components/global-context-menu.tsx | Navigation | Yes | Yes | `nav.*` |
| Personal / Work OS | src/components/app-shell.tsx | Sidebar brand | Yes | Yes | `common.appKicker`, `common.appTitle` |
| Sign out | src/components/app-shell.tsx | Button | Yes | Yes | `nav.signOut` |
| {n} running | src/components/app-shell.tsx | Sidebar summary | Yes | Yes (interpolated) | `nav.running` |
| Work Operating System / Organize, work, track… | src/routes/auth.tsx | Auth header | Yes | Yes | `auth.title`, `auth.subtitle` |
| Email / Password | src/routes/auth.tsx | Labels | Yes | Yes | `auth.email`, `auth.password` |
| Sign in / Create account / Send reset link | src/routes/auth.tsx | Buttons | Yes | Yes | `auth.signIn`, `auth.createAccount`, `auth.sendResetLink` |
| I already have an account / Create an account / Back to sign in / Forgot password? | src/routes/auth.tsx | Links | Yes | Yes | `auth.haveAccount`, `auth.createAccountLink`, `auth.backToSignIn`, `auth.forgotPassword` |
| Password reset email sent. | src/routes/auth.tsx | Notice | Yes | Yes | `auth.resetSent` |
| Today / Syncing your workspace… / {s} sections · {t} tables | src/routes/index.tsx | Dashboard header | Yes | Yes | `dashboard.title`, `dashboard.syncing`, `dashboard.counts` |
| Tracked today / Running sessions / Average progress / Completed items | src/routes/index.tsx | Stat cards | Yes | Yes | `dashboard.*` |
| By status / Closest to done / Start a focus round / See today's plan | src/routes/index.tsx | Sections & links | Yes | Yes | `dashboard.*` |
| todo / in progress / blocked / review / done | src/routes/index.tsx, src/components/item-library.tsx | Status labels (display only) | Yes | Yes (enum value untouched) | `status.*` |
| Active work / Sessions run independently… / Pause / Resume / Stop / No open sessions… | src/routes/active.tsx | Session cards | Yes | Yes | `active.*` |
| Search / Search everything… / No matches. | src/routes/search.tsx | Search page | Yes | Yes | `search.*` |
| Section / Table / Row / Column / Task / Topic / Note / Link / Attachment | src/routes/search.tsx | Result kind badge | Yes | Yes | `kind.*` |
| Tasks / Topics + subtitles | src/routes/tasks.tsx, src/routes/topics.tsx | Page titles | Yes | Yes | `tasks.*`, `topics.*` |
| Filter by title… / Filter by status / All statuses / In: … / Not placed in any table / Nothing here yet. | src/components/item-library.tsx | Filters & empty state | Yes | Yes | `library.*`, `status.all`, `common.empty` |
| Settings, Language & direction, Theme, Table density, Show running total… | src/routes/settings.tsx | Settings form | Yes | Yes | `settings.*` |
| Pomodoro Focus + all round-length labels | src/routes/settings.tsx | Settings form | Yes | Yes | `settings.*` |
| Chrome notification toasts & permission button | src/routes/settings.tsx | Toasts/button | Yes | Yes | `settings.notifications*`, `settings.allowNotifications` |
| Demo data block + toasts | src/routes/settings.tsx | Section, buttons, toasts | Yes | Yes | `settings.demo*` |
| Work OS / Go to page / Light theme / Dark theme / Highlight selection / Clear highlights / Add sticky note / Copy page link / Copy selection / Scroll to top / Reload data | src/components/global-context-menu.tsx | Global menu | Yes | Yes | `common.*`, `nav.goToPage`, `menu.*` |
| Yellow / Green / Blue / Pink / Orange | src/components/global-context-menu.tsx | Highlight colors | Yes | Yes | `color.*` |
| Firebase auth error copy | src/hooks/useAuth.tsx | Error mapping | Yes | Phase 2 | `errors.*` (planned) |
| Tables workspace labels, item detail tabs, focus table controls, optimizer/assistant/documentation copy | src/routes/tables.tsx, src/routes/item.$itemId.tsx, src/components/focus-task-table.tsx, src/routes/optimizer.tsx, src/routes/assistant.tsx, src/routes/documentation.tsx | Dense workspace UI | Yes | Phase 2 (tracked) | see 02 report |
| `<head>` meta titles/descriptions | all route files | SEO metadata | Yes | No (kept English for stable SEO/OG) | INTENTIONAL |
| AI system prompt text | src/lib/ai-prompt.ts, src/lib/ai.server.ts | SYSTEM_PROMPT / MODEL_INSTRUCTION | No | No | INTERNAL_ONLY |
