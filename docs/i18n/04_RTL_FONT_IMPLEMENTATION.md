# RTL / LTR and Font Implementation

## Direction
`src/lib/settings-store.tsx` (existing effect) applies:

```ts
root.lang = settings.language;              // "en" | "ar"
root.dir  = settings.language === "ar" ? "rtl" : "ltr";
```

Direction is therefore document-level and every page inherits it. Layout code already uses
logical utilities (`me-*`, `ms-*`, `text-end`, `start/end` popover sides), so sidebar, menus,
tables, dialogs and forms mirror without per-component overrides. Deliberate exceptions:
timers, durations and percentages render inside `dir="ltr"` wrappers so digits stay readable.

## Font
Loaded once in the root route head (`src/routes/__root.tsx`):

```ts
{ rel: "preconnect", href: "https://fonts.googleapis.com" },
{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap" },
```

(Remote font stylesheets must be `<link>` tags — Tailwind v4 cannot `@import` a remote URL.)

Applied only to the Arabic UI in `src/styles.css`:

```css
html[lang="ar"], html[lang="ar"] body, html[lang="ar"] button,
html[lang="ar"] input, html[lang="ar"] textarea, html[lang="ar"] select {
  font-family: "Cairo", ui-sans-serif, system-ui, -apple-system, sans-serif;
}
```

English keeps the project's existing font stack, so the English design is untouched.

## Language switcher
- Settings -> "Language & direction" select (`en` / `ar`).
- Global right-click menu -> language toggle.
Both write to the user's settings document, which drives text, direction and font in one pass.
