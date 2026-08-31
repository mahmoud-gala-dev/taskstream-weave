import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings-store";

/**
 * In-app cheat sheet for the global Alt shortcuts. It also explains how quick
 * capture is wired to the late-round count on /today and lets the user pick a
 * different capture key (persisted in settings).
 */
export function ShortcutsPanel() {
  const t = useT();
  const { settings, update } = useSettings();
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const captureKey = (settings.captureShortcut || "n").toUpperCase();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const el = event.target as HTMLElement | null;
      const typing = el?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el?.tagName ?? "");
      if (recording) {
        const key = event.key.toLowerCase();
        if (key === "escape") {
          setRecording(false);
          return;
        }
        if (/^[a-z0-9]$/.test(key)) {
          event.preventDefault();
          update({ captureShortcut: key });
          setRecording(false);
          toast.success(t("shortcuts.saved"));
        }
        return;
      }
      if (event.key === "Escape") setOpen(false);
      if (!event.altKey || event.ctrlKey || event.metaKey || typing) return;
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [recording, update, t]);

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
        {t("shortcuts.open")} · Alt+K
      </Button>
    );
  }

  const rows: { combo: string; label: string }[] = [
    { combo: `Alt+${captureKey}`, label: t("shortcuts.capture") },
    { combo: "Alt+F", label: t("shortcuts.focus") },
    { combo: "Alt+T", label: t("shortcuts.tasks") },
    { combo: "Alt+P", label: t("shortcuts.topics") },
    { combo: "Alt+D", label: t("shortcuts.documentation") },
    { combo: "Alt+S", label: t("shortcuts.search") },
    { combo: "Alt+K", label: t("shortcuts.panel") },
    { combo: "Esc", label: t("shortcuts.escape") },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-label={t("shortcuts.title")}
        className="w-full max-w-lg rounded-xl border border-border bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold">{t("shortcuts.title")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("shortcuts.subtitle")}</p>

        <div className="mt-3 rounded-md border border-border bg-background/60 p-3">
          <p className="text-xs font-medium">{t("shortcuts.capture")}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("shortcuts.captureHow")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <kbd className="rounded border border-border px-2 py-1 font-mono text-xs" dir="ltr">
              Alt+{captureKey}
            </kbd>
            <Button size="sm" variant="outline" onClick={() => setRecording(true)}>
              {recording ? t("shortcuts.recording") : t("shortcuts.change")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => update({ captureShortcut: "n" })}>
              {t("shortcuts.reset")}
            </Button>
            <span className="text-[11px] text-muted-foreground">{t("shortcuts.customizeHint")}</span>
          </div>
        </div>

        <ul className="mt-3 space-y-1">
          {rows.map((row) => (
            <li key={row.combo} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent/50">
              <span className="min-w-0 truncate">{row.label}</span>
              <kbd className="rounded border border-border px-2 py-0.5 font-mono text-xs" dir="ltr">
                {row.combo}
              </kbd>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
            {t("common.close")}
          </Button>
        </div>
      </div>
    </div>
  );
}
