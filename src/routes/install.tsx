import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/install")({
  head: () => ({
    meta: [
      { title: "Install the app — Personal Work OS" },
      {
        name: "description",
        content: "Add Work OS to your phone home screen and download the app shortcut file.",
      },
      { property: "og:title", content: "Install the app — Personal Work OS" },
      {
        property: "og:description",
        content: "Step-by-step install instructions for Android, iPhone and desktop.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <InstallPage />
    </AppShell>
  ),
});

type InstallPrompt = Event & { prompt: () => Promise<void> };

function InstallPage() {
  const t = useT();
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    function onPrompt(event: Event) {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return (
    <div className="work-os-arabic-surface mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">{t("install.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("install.subtitle")}</p>

      <section className="mt-6 flex items-center gap-4 rounded-xl border border-border bg-card p-4">
        <img src="/app-icon-192.png" width={64} height={64} loading="lazy" alt={t("install.iconTitle")} className="size-16 rounded-2xl" />
        <div>
          <p className="text-sm font-semibold">{t("install.iconTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("install.iconHint")}</p>
        </div>
      </section>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          disabled={!prompt}
          onClick={() => {
            void prompt?.prompt();
          }}
        >
          {t("install.button")}
        </Button>
        <a
          href="/manifest.webmanifest"
          download="work-os.webmanifest"
          className="inline-flex items-center rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
        >
          {t("install.download")}
        </a>
      </div>
      {!prompt ? <p className="mt-2 text-xs text-muted-foreground">{t("install.unavailable")}</p> : null}
      <p className="mt-1 text-xs text-muted-foreground">{t("install.downloadHint")}</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Step title={t("install.androidTitle")} body={t("install.android")} />
        <Step title={t("install.iosTitle")} body={t("install.ios")} />
        <Step title={t("install.desktopTitle")} body={t("install.desktop")} />
      </div>
    </div>
  );
}

function Step({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
