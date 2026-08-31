import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import type { FirebaseStorage } from "firebase/storage";

export type FirebaseBundle = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
};

let bundle: Promise<FirebaseBundle> | undefined;

async function init(): Promise<FirebaseBundle> {
  const { getFirebaseConfig } = await import("./firebase-config.functions");
  const config = await getFirebaseConfig();

  const [{ initializeApp, getApps, getApp }, authMod, firestoreMod, storageMod] =
    await Promise.all([
      import("firebase/app"),
      import("firebase/auth"),
      import("firebase/firestore"),
      import("firebase/storage"),
    ]);

  const app = getApps().length ? getApp() : initializeApp(config);
  const auth = authMod.getAuth(app);
  await authMod.setPersistence(auth, authMod.browserLocalPersistence).catch(() => undefined);
  const db = firestoreMod.getFirestore(app);
  const storage = storageMod.getStorage(app);

  // Analytics is optional and must never break the app.
  void import("firebase/analytics")
    .then(async (m) => {
      if (await m.isSupported()) m.getAnalytics(app);
    })
    .catch(() => undefined);

  return { app, auth, db, storage };
}

/** Lazily initializes Firebase in the browser. Never call during SSR. */
export function getFirebase(): Promise<FirebaseBundle> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Firebase is browser-only"));
  }
  bundle ??= init();
  return bundle;
}

/** Fire-and-forget analytics event. Never send private task content. */
export async function trackEvent(name: string, params?: Record<string, string | number>) {
  try {
    const { app } = await getFirebase();
    const m = await import("firebase/analytics");
    if (await m.isSupported()) m.logEvent(m.getAnalytics(app), name, params);
  } catch {
    /* analytics is best-effort */
  }
}
