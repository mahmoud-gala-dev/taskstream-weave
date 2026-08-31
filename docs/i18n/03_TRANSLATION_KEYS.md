# Translation Keys

Source of truth: `src/lib/i18n.tsx`.

## Convention
`<domain>.<name>` in lowerCamelCase. Domains in use:

| Domain | Purpose |
| --- | --- |
| `common.*` | Shared verbs, states and app brand |
| `nav.*` | Navigation and sidebar |
| `auth.*` | Sign in / sign up / reset |
| `dashboard.*` | Dashboard page |
| `status.*` | Display labels for the `ItemStatus` enum |
| `active.*` | Active work / sessions |
| `search.*`, `kind.*` | Search page and result kinds |
| `tasks.*`, `topics.*`, `library.*` | Task and topic libraries |
| `settings.*` | Settings, Pomodoro, notifications, demo data |
| `menu.*`, `color.*` | Global right-click menu |

## Interpolation
`t("nav.running", { count })` -> `{count} running` / `{count} قيد التشغيل`.
Placeholders use `{name}`. `settings.doneMessageHint` intentionally documents the
`{task}` / `{minutes}` placeholders of the user's own notification template.

## Consistent terminology (en -> ar)
Dashboard -> لوحة التحكم · Settings -> الإعدادات · Tables -> الجداول ·
Tasks -> المهام · Topics -> المواضيع · Documentation -> التوثيق ·
Search -> البحث · Focus -> التركيز · Session -> جلسة · Progress -> التقدم
