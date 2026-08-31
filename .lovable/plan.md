# Table, notes, files and pagination improvements

## 1. Table scrolling and keyboard control
- Lock horizontal scrolling while a focus round is running on the Tables page (vertical scroll stays available).
- Add left/right arrow-key control that scrolls the table horizontally when the grid has keyboard focus, with visible focus outline.

## 2. Cell icon size
- Increase the cell icon size in the table grid (and in the icon picker preview) so icons are clearly readable.

## 3. Distinctive Arabic Google font
- Load a distinctive Arabic Google font (Cairo for UI, plus a display face such as Rakkas/Lemonada for headings) via a `<link>` in the root route.
- Apply it across the whole table grid and the table/item detail page when the locale is Arabic; Latin text keeps the current font stack.

## 4. Snapshot on the Focus page
- Fix "Take a snapshot" so the captured image is actually inserted: capture the focus panel, store it, and insert it into the target note/cell with a visible confirmation and an error toast when capture fails.

## 5. Highlight text colour
- When a highlight colour is chosen, compute the text colour automatically from the background luminance (dark text on light highlights, light text on dark ones) everywhere highlights render.

## 6. Confirmation dialogs
- Replace remaining `window.confirm` calls with Sonner confirmation toasts (action + cancel), so destructive actions use one consistent style.

## 7. Sticky notes drag and ordering
- Keep free drag on page sticky notes and add easy reordering (drag to reorder in a tidy grid mode, persisted per user).

## 8. Markdown, PDF and image files
- Allow uploading `.md`, `.pdf` and image files in the attachment area.
- Render Markdown, PDF and images inline in the viewer, with easy text/area selection (copy for text, selectable region highlight for PDFs and images).

## 9. Pomodoro Focus pagination
- Paginate the Focus page task table and recorded rounds list.

## 10. Tasks, Topics, Documentation
- Add a statistics strip (counts, status/priority breakdown, tracked time, recent activity) to each page.
- Add pagination to their lists.

## Technical notes
- All work stays on the existing Firebase data model; new persisted fields (note order, file kind) are optional and additive.
- Pagination is client-side over already-loaded workspace data, with a shared reusable pager component.
- Files continue to upload to Firebase Storage with the existing local fallback; PDF rendering uses a Worker-safe, bundled viewer.
- New Arabic strings go through the existing `useT()` key system.
