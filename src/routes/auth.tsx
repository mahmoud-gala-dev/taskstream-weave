import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Personal Work OS" },
      {
        name: "description",
        content:
          "Sign in to your Personal Work Operating System to organize tables, run work sessions and document progress.",
      },
      { property: "og:title", content: "Sign in — Personal Work OS" },
      {
        property: "og:description",
        content: "Access your tables, tasks, topics and work sessions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "reset";

function AuthPage() {
  const { user, signIn, signUp, signInAsGuest, resetPassword, error } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const t = useT();

  useEffect(() => {
    if (user) void navigate({ to: "/" });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signin") await signIn(email, password);
      else if (mode === "signup") await signUp(email, password);
      else {
        await resetPassword(email);
        setNotice(t("auth.resetSent"));
      }
    } catch {
      /* error surfaced via context */
    } finally {
      setBusy(false);
    }
  }

  async function handleGuestSignIn() {
    setBusy(true);
    setNotice(null);
    try {
      await signInAsGuest({ seedData: true });
      void navigate({ to: "/" });
    } catch {
      /* error handled */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <AuthBackdrop />
      <div className="relative z-10 grid w-full max-w-4xl items-center gap-10 lg:grid-cols-2">
        <section className="hidden lg:block">
          <AuthArtwork />
        </section>

        <div className="w-full rounded-2xl border border-border/70 bg-card/80 p-6 shadow-xl backdrop-blur-md sm:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("auth.kicker")}</p>
          <h1 className="mt-1 text-2xl font-semibold">{t("auth.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("auth.subtitle")}
          </p>

          {/* Guest Mode Quick Access Card */}
          <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4 transition-colors hover:border-primary/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-4 text-primary animate-pulse" />
                  {t("auth.guestMode")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("auth.guestSubtitle")}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="mt-3 w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-medium text-sm gap-2"
              disabled={busy}
              onClick={handleGuestSignIn}
            >
              <UserCheck className="size-4" />
              {t("auth.continueAsGuest")}
            </Button>
          </div>

          <div className="relative my-6 text-center text-xs text-muted-foreground">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-border" />
            </div>
            <span className="relative bg-card/80 px-2 uppercase tracking-wider backdrop-blur-md">
              {t("auth.orDivider")}
            </span>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {mode !== "reset" ? (
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {notice ? <p className="text-sm text-primary">{notice}</p> : null}

            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "signin"
                ? t("auth.signIn")
                : mode === "signup"
                  ? t("auth.createAccount")
                  : t("auth.sendResetLink")}
            </Button>
          </form>

          <div className="mt-6 flex justify-between text-sm text-muted-foreground">
            <button
              type="button"
              className="underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            >
              {mode === "signup" ? t("auth.haveAccount") : t("auth.createAccountLink")}
            </button>
            <button
              type="button"
              className="underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "reset" ? "signin" : "reset")}
            >
              {mode === "reset" ? t("auth.backToSignIn") : t("auth.forgotPassword")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Soft animated gradient orbs behind the card. */
function AuthBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute -left-24 -top-24 size-80 animate-pulse rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -bottom-32 -right-16 size-96 rounded-full bg-primary/10 blur-3xl" />
      <svg className="absolute inset-0 size-full opacity-[0.07]" aria-hidden>
        <defs>
          <pattern id="auth-grid" width="36" height="36" patternUnits="userSpaceOnUse">
            <path d="M36 0H0V36" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#auth-grid)" />
      </svg>
    </div>
  );
}

/**
 * Animated SVG that tells the product story: a work table whose rows fill in,
 * a focus ring counting down and a rising progress line.
 */
function AuthArtwork() {
  return (
    <svg
      viewBox="0 0 420 340"
      role="img"
      aria-label="Animated illustration of a work table, a focus timer and a rising progress line"
      className="w-full text-primary"
    >
      <g stroke="currentColor" fill="none">
        <rect x="18" y="26" width="230" height="150" rx="14" strokeWidth="2" opacity="0.5" />
        <line x1="18" y1="62" x2="248" y2="62" strokeWidth="1.5" opacity="0.35" />
        <line x1="96" y1="26" x2="96" y2="176" strokeWidth="1.5" opacity="0.25" />
        <line x1="172" y1="26" x2="172" y2="176" strokeWidth="1.5" opacity="0.25" />
      </g>

      {[0, 1, 2].map((row) => (
        <rect
          key={row}
          x="32"
          y={78 + row * 30}
          height="12"
          rx="6"
          fill="currentColor"
          opacity="0.35"
        >
          <animate
            attributeName="width"
            values="18;190;18"
            dur="6s"
            begin={`${row * 0.7}s`}
            repeatCount="indefinite"
          />
        </rect>
      ))}

      <g transform="translate(330 96)">
        <circle r="46" fill="none" stroke="currentColor" strokeWidth="6" opacity="0.15" />
        <circle
          r="46"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="289"
          transform="rotate(-90)"
        >
          <animate attributeName="stroke-dashoffset" values="289;0" dur="8s" repeatCount="indefinite" />
        </circle>
        <circle r="6" fill="currentColor">
          <animate attributeName="r" values="5;8;5" dur="2s" repeatCount="indefinite" />
        </circle>
      </g>

      <path
        d="M28 300 L108 268 L176 282 L250 220 L330 236 L400 178"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="520"
      >
        <animate attributeName="stroke-dashoffset" values="520;0" dur="4s" repeatCount="indefinite" />
      </path>

      {[
        { cx: 108, cy: 268 },
        { cx: 250, cy: 220 },
        { cx: 400, cy: 178 },
      ].map((dot, i) => (
        <circle key={dot.cx} cx={dot.cx} cy={dot.cy} r="4" fill="currentColor">
          <animate
            attributeName="opacity"
            values="0.2;1;0.2"
            dur="3s"
            begin={`${i * 0.5}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </svg>
  );
}

