import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";

import { getFirebase } from "@/lib/firebase";
import { hasDemoData, seedDemoData } from "@/lib/demo-data";

export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAnonymous?: boolean;
  isGuest?: boolean;
};

type AuthState = {
  user: User | AppUser | null;
  isGuest: boolean;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signInAsGuest: (options?: { seedData?: boolean }) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const GUEST_KEY = "work-os:guest-user";

export const GUEST_USER: AppUser = {
  uid: "guest_user_demo",
  email: "guest@work-os.local",
  displayName: "Guest User",
  isAnonymous: true,
  isGuest: true,
};

function readGuestUser(): AppUser | null {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
}

function message(e: unknown): string {
  const code = (e as { code?: string } | null)?.code ?? "";
  const map: Record<string, string> = {
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/invalid-email": "That email address looks invalid.",
    "auth/email-already-in-use": "An account already exists with that email.",
    "auth/weak-password": "Use at least 6 characters for the password.",
    "auth/too-many-requests": "Too many attempts. Try again in a moment.",
    "auth/network-request-failed": "Network problem — check your connection.",
    "auth/operation-not-allowed": "Email/password sign-in is disabled in Firebase.",
    "auth/configuration-not-found":
      "Firebase Authentication is not set up yet. In the Firebase console for project “link-hun”, open Authentication → Get started and enable the Email/Password provider, then add this preview domain under Authentication → Settings → Authorized domains.",
    "auth/unauthorized-domain":
      "This domain is not authorized in Firebase. Add it under Authentication → Settings → Authorized domains.",
  };
  return map[code] ?? (e instanceof Error ? e.message : "Something went wrong.");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | AppUser | null>(() => readGuestUser());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsub = () => {};
    let active = true;
    (async () => {
      try {
        const { auth } = await getFirebase();
        const { onAuthStateChanged } = await import("firebase/auth");
        if (!active) return;
        unsub = onAuthStateChanged(auth, (u) => {
          if (u) {
            setUser(u);
            if (typeof localStorage !== "undefined") {
              localStorage.removeItem(GUEST_KEY);
            }
          } else {
            const guest = readGuestUser();
            setUser(guest);
          }
          setLoading(false);
        });
      } catch (e) {
        if (!active) return;
        const guest = readGuestUser();
        setUser(guest);
        // Only surface Firebase error if there's no active guest session
        if (!guest) {
          setError(message(e));
        }
        setLoading(false);
      }
    })();
    return () => {
      active = false;
      unsub();
    };
  }, []);

  const isGuest = Boolean(user && ("isGuest" in user ? user.isGuest : user.isAnonymous));

  const value = useMemo<AuthState>(
    () => ({
      user,
      isGuest,
      loading,
      error,
      async signIn(email, password) {
        setError(null);
        try {
          const { auth } = await getFirebase();
          const { signInWithEmailAndPassword } = await import("firebase/auth");
          await signInWithEmailAndPassword(auth, email, password);
          if (typeof localStorage !== "undefined") {
            localStorage.removeItem(GUEST_KEY);
          }
        } catch (e) {
          setError(message(e));
          throw e;
        }
      },
      async signUp(email, password, displayName) {
        setError(null);
        try {
          const { auth } = await getFirebase();
          const { createUserWithEmailAndPassword, updateProfile } = await import("firebase/auth");
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          if (displayName) await updateProfile(cred.user, { displayName });
          if (typeof localStorage !== "undefined") {
            localStorage.removeItem(GUEST_KEY);
          }
        } catch (e) {
          setError(message(e));
          throw e;
        }
      },
      async signInAsGuest(options = { seedData: true }) {
        setError(null);
        const guest = GUEST_USER;
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(GUEST_KEY, JSON.stringify(guest));
        }
        setUser(guest);

        if (options.seedData && !hasDemoData()) {
          try {
            await seedDemoData(guest.uid);
          } catch {
            /* non-fatal */
          }
        }
      },
      async signOut() {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(GUEST_KEY);
        }
        setUser(null);
        try {
          const { auth } = await getFirebase();
          const { signOut } = await import("firebase/auth");
          await signOut(auth);
        } catch {
          /* offline or not initialized */
        }
      },
      async resetPassword(email) {
        setError(null);
        try {
          const { auth } = await getFirebase();
          const { sendPasswordResetEmail } = await import("firebase/auth");
          await sendPasswordResetEmail(auth, email);
        } catch (e) {
          setError(message(e));
          throw e;
        }
      },
    }),
    [user, isGuest, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

