import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

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
  const { user, signIn, signUp, resetPassword, error } = useAuth();
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


        <form onSubmit={submit} className="mt-8 space-y-4">
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
  );
}
