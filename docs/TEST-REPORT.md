# Test Report

Verification method: TypeScript typecheck (`tsgo --noEmit`), production-style
build of the dev server, and manual flows against the live Firebase project
`link-hun` in the preview.

## Automated

| Check | Result |
| --- | --- |
| TypeScript typecheck, whole project | Pass |
| Dev server compiles all routes, `/auth` returns 200 | Pass |
| No browser console or runtime errors on load | Pass |

## Manual flows

| Flow | Result |
| --- | --- |
| Sign up, sign out, sign in, password reset email | Pass |
| Create section, table, rows, columns | Pass |
| Create task and topic, place in cell | Pass |
| Reorder items inside one cell | Pass |
| Move item cell → cell | Pass |
| Move item table → table | Pass |
| Same item placed in two tables, edit reflects in both | Pass |
| Move table to another section | Pass |
| Reorder sections, tables, rows, columns | Pass |
| Remove placement leaves the item intact | Pass |
| Delete table removes rows/columns/cells/placements only | Pass |
| Start several sessions at once | Pass |
| Refresh keeps timers accurate | Pass |
| Pause / resume / stop | Pass |
| Notes, links, subtasks | Pass |
| File upload to Storage | Pass |
| Ctrl+V screenshot attachment | Pass |
| Progress change | Pass |
| AI optimizer preview and reject | Pass |
| AI unavailable / timeout shows an error, no data change | Pass |

## Known issues

- Screen recording depends on `getDisplayMedia`; unavailable in browsers or
  contexts that block it, where the UI reports an explicit error.
- Rules deployment is manual, so ownership enforcement should be re-verified
  after each `firebase deploy`.
- Large tables (500+ placements) have not been load-tested.
