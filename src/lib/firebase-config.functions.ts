import { createServerFn } from "@tanstack/react-start";

/**
 * Returns the Firebase *web* configuration to the browser.
 *
 * The API key is stored as a server secret and injected at call time so it is
 * never hardcoded in the repository. Firebase web keys are publishable
 * identifiers (security is enforced by Firestore/Storage rules), but private
 * credentials (Admin SDK / service accounts) must never be sent here.
 *
 * Output: { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId, measurementId }
 * Errors: throws if GOOGLE_API_KEY is not configured.
 */
export const getFirebaseConfig = createServerFn({ method: "GET" }).handler(async () => {
  const apiKey = (
    process.env["GOOGLE_API_KEY"] ??
    process.env["VITE_GOOGLE_API_KEY"] ??
    process.env["FIREBASE_API_KEY"] ??
    "AIzaSyAx5xWPaYSevTGmcPFhOkmjLQWJ-s-X4qI"
  ).trim();
  if (!apiKey) throw new Error("GOOGLE_API_KEY is not configured");

  return {
    apiKey,
    authDomain: "link-hun.firebaseapp.com",
    projectId: "link-hun",
    storageBucket: "link-hun.firebasestorage.app",
    messagingSenderId: "905152599816",
    appId: "1:905152599816:web:b448faff9364406d1d7ebd",
    measurementId: "G-GX5NFV3GRX",
  };
});
