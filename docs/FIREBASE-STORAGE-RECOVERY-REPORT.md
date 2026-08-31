# Firebase Storage recovery report

Date: 2026-08-31

## Diagnosis

- Both `link-hun.firebasestorage.app` and the legacy `link-hun.appspot.com` endpoint return `404 Not Found` from the Firebase Storage API.
- The response already includes `Access-Control-Allow-Origin: *`. The browser's visible CORS/401 message is therefore a secondary symptom; the configured bucket has not been provisioned or is unavailable.
- Firebase CLI has no authorized account in this workspace, so rules and bucket configuration cannot be deployed from here without the project owner's authorization.

## Implemented now

- Firebase Storage remains the primary cloud upload path.
- Files up to 500 KB fall back to an inline Firestore attachment when cloud storage is unavailable.
- Larger files and real video blobs fall back to persistent IndexedDB storage on the current device, avoiding the failed remote request as the final user-visible outcome.
- Local video/file URLs are restored after reload, previewed and downloadable in the Files tab.
- Local-only attachments are labelled explicitly; missing local blobs on another device are reported instead of showing a broken player.
- Video previews now use `playsInline` and `preload="metadata"`.

## Remaining owner steps for cloud sync

1. In Firebase Console for `link-hun`, open **Build → Storage** and create/enable the default bucket. In 2026 Firebase requires the Blaze billing plan for Cloud Storage access, although no-cost usage quotas may still apply.
2. Authenticate the Firebase CLI locally with `firebase login`.
3. From this repository run:

   ```bash
   npx firebase-tools deploy --only firestore:rules,storage --project link-hun
   ```

4. Create `cors.json` with the production and preview origins, then apply it with Google Cloud CLI:

   ```json
   [{
     "origin": [
       "https://id-preview--d775cb90-6888-41a3-8439-f9591af1c515.lovable.app"
     ],
     "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
     "responseHeader": ["Content-Type", "Authorization", "Range"],
     "maxAgeSeconds": 3600
   }]
   ```

   ```bash
   gcloud storage buckets update gs://link-hun.firebasestorage.app --cors-file=cors.json
   ```

5. Add the final published/custom domain to `origin` before launch and repeat the CORS command.
6. Test while signed in: upload an image, a file larger than 500 KB, and a WebM recording; reload and test from a second device to confirm cloud sync.

## Free-service decision

No second cloud provider was hard-wired into the application. Adding one would split authentication, access control, deletion and privacy across two systems. The implemented IndexedDB fallback is free and works immediately on one device. If cross-device media storage must remain card-free, Cloudinary's free tier is a reasonable later adapter, but its quotas and unsigned-upload security constraints must be accepted explicitly.

## Product assessment

The Personal Work OS concept is strong because it joins planning, focused execution, timers and evidence/documentation in one item context rather than behaving like a basic to-do list. The main product risk is breadth: tables, tasks, notes, recordings, dashboards and AI can dilute the core loop. The recommended launch focus is **plan → focus → document → review**, with media retention limits and cleanup controls before broad adoption.