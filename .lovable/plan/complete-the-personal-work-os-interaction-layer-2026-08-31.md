# Complete the Personal Work OS interaction layer

## Scope
Finish the requested table, focus, notes, subtasks, attachments, AI, PWA, and authentication verification work while preserving the existing Firebase data model and current routes.

## Implementation

### 1. Tables and sections
- Make the Sections panel show/hide control persistent, keyboard accessible, and independent from whether a table is selected.
- Persist each section’s expanded/collapsed state so it survives navigation and refresh.
- Strengthen the table presentation with stable row/column sizing, full horizontal access to every column, clearer headers/cells, and a smooth styled scrollbar.
- Complete context menus for sections, tables, rows, columns, cells, and item cards with consistent icon/text spacing and the expanded icon palette.
- Keep cell color, icon, and quick note editing persisted in the existing `cells` collection.

### 2. Multiple Pomodoro timers inside tables
- Add an inline Pomodoro tray to the Tables page where several task/topic rounds can run concurrently.
- Each timer will show task title, elapsed/remaining time, controls, and 0/25/50/75/100 progress markers.
- Reuse durations, long-break cadence, and notification lead time from Settings.
- Request browser notification permission only through a user action and send near-end/completion notifications.
- Persist completed focus rounds as `WorkSession` records so Dashboard and item totals update from real data.
- Keep `/focus` as the expanded single-timer view and allow launching timers directly from a cell/item menu.

### 3. Sortable subtasks
- Convert the subtask list to dnd-kit sorting with pointer and keyboard sensors.
- Persist only the final order on drop using spaced numeric ordering and retain the existing done ↔ not-done toggle.
- Add a visible drag handle and accessible move controls without changing subtask ownership or completion semantics.

### 4. Multiple rich and sticky notes
- Extend notes with optional title, color, pinned/sticky state, and safe structured highlight ranges.
- Add a compact note composer that supports selected-text highlighting, color choice, editing, pinning, and deletion.
- Render pinned notes as a sticky-note area in the item detail page; keep all notes searchable and visible in Documentation.
- Preserve plain text as the source of truth and render highlights without injecting raw HTML.

### 5. Attachment drop zone and file browser
- Add multi-file selection and drag-and-drop upload with clear drag, upload, failure, and progress states.
- Build a responsive attachment browser with file-type icons, image/video/audio/PDF preview where supported, open/download, and delete actions.
- Keep pasted screenshots and screen recording intact and continue storing binaries in Firebase Storage with metadata in Firestore.

### 6. Existing feature completion
- Verify AI Optimizer analyzes current tasks, topics, and cell notes and is linked into Daily Assistant.
- Verify PWA manifest, SVG app icon, favicon, and root metadata load correctly.
- Verify sign-up, sign-in, sign-out, and password reset UX and preserve friendly Firebase configuration errors.

### 7. Rules, deployment, and end-to-end validation
- Re-check Firestore and Storage ownership rules for any extended note fields and existing attachments; no rule widening is expected because fields stay user-owned.
- Attempt rules deployment with the available Firebase CLI credentials. If project-console authorization is unavailable, provide the exact remaining console/deploy steps rather than claiming deployment.
- Run the project typecheck/tests and browser-check `/tables`, `/focus`, item detail, Dashboard, Assistant, Optimizer, Settings, and Auth.
- When an authenticated test session is available, exercise Section → Table → Row → Cell creation and drag/drop plus Pomodoro completion persistence end to end.

## Technical details
- Continue using `@dnd-kit` for sorting and placement movement.
- Use one shared client-side Pomodoro controller so concurrent timers remain stable while the Tables route is mounted; completed rounds write through the existing session helpers.
- Extend current Firestore TypeScript types additively; existing note records without the new optional fields remain valid.
- Sanitize file preview decisions by MIME type and never execute uploaded content.
