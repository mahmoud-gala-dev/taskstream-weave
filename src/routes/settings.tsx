import { createFileRoute } from "@tanstack/react-router";

import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearDemoData, hasDemoData, seedDemoData } from "@/lib/demo-data";
import { useSettings } from "@/lib/settings-store";
import { useWorkspace } from "@/lib/workspace-store";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Personal Work OS" },
      {
        name: "description",
        content: "Choose your language and direction, theme, table density and timer preferences.",
      },
      { property: "og:title", content: "Settings — Personal Work OS" },
      { property: "og:description", content: "Language, theme and density preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <SettingsPage />
    </AppShell>
  ),
});

function SettingsPage() {
  const { settings, update } = useSettings();
  const { userId } = useWorkspace();
  const t = useT();
  const [busy, setBusy] = useState<"seed" | "clear" | null>(null);

  async function seed() {
    if (!userId) {
      toast.error(t("settings.signInFirst"));
      return;
    }
    setBusy("seed");
    try {
      const count = await seedDemoData(userId);
      toast.success(t("settings.demoAdded"), {
        description: t("settings.demoAddedDetail", { count }),
      });
    } catch {
      toast.error(t("settings.demoAddFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function clear() {
    setBusy("clear");
    try {
      const count = await clearDemoData();
      toast[count ? "success" : "info"](
        count ? t("settings.demoRemoved") : t("settings.demoNone"),
        count ? { description: t("settings.demoRemovedDetail", { count }) } : undefined,
      );
    } catch {
      toast.error(t("settings.demoDeleteFailed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-xl p-6">
      <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("settings.subtitle")}
      </p>

      <div className="mt-6 space-y-5">
        <Field id="language" label={t("settings.languageLabel")}>
          <select
            id="language"
            value={settings.language}
            onChange={(e) => update({ language: e.target.value as "en" | "ar" })}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="en">{t("settings.languageEn")}</option>
            <option value="ar">{t("settings.languageAr")}</option>
          </select>
        </Field>

        <Field id="theme" label={t("settings.theme")}>
          <select
            id="theme"
            value={settings.theme}
            onChange={(e) => update({ theme: e.target.value as "light" | "dark" | "system" })}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="system">{t("settings.themeSystem")}</option>
            <option value="light">{t("settings.themeLight")}</option>
            <option value="dark">{t("settings.themeDark")}</option>
          </select>
        </Field>

        <Field id="density" label={t("settings.density")}>
          <select
            id="density"
            value={settings.density}
            onChange={(e) =>
              update({ density: e.target.value as "compact" | "comfortable" | "large" })
            }
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="compact">{t("settings.densityCompact")}</option>
            <option value="comfortable">{t("settings.densityComfortable")}</option>
            <option value="large">{t("settings.densityLarge")}</option>
          </select>
        </Field>

        <Field id="fontFamily" label={t("appearance.fontFamily")}>
          <select
            id="fontFamily"
            value={settings.fontFamily}
            onChange={(e) => update({ fontFamily: e.target.value as "sans" | "serif" | "mono" })}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="sans">{t("appearance.fontSans")}</option>
            <option value="serif">{t("appearance.fontSerif")}</option>
            <option value="mono">{t("appearance.fontMono")}</option>
          </select>
        </Field>

        <Number
          id="fontScale"
          label={t("appearance.fontScale")}
          value={settings.fontScale}
          min={80}
          max={140}
          onChange={(fontScale) => update({ fontScale })}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.timerInSidebar}
            onChange={(e) => update({ timerInSidebar: e.target.checked })}
          />
          {t("settings.timerInSidebar")}
        </label>
      </div>


      <h2 className="mt-10 text-lg font-semibold">{t("settings.pomodoro")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("settings.pomodoroSubtitle")}
      </p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Number
          id="focusMinutes"
          label={t("settings.focusMinutes")}
          value={settings.focusMinutes}
          min={5}
          max={120}
          onChange={(focusMinutes) => update({ focusMinutes })}
        />
        <Number
          id="breakMinutes"
          label={t("settings.breakMinutes")}
          value={settings.breakMinutes}
          min={1}
          max={60}
          onChange={(breakMinutes) => update({ breakMinutes })}
        />
        <Number
          id="longBreakMinutes"
          label={t("settings.longBreakMinutes")}
          value={settings.longBreakMinutes}
          min={5}
          max={90}
          onChange={(longBreakMinutes) => update({ longBreakMinutes })}
        />
        <Number
          id="roundsBeforeLongBreak"
          label={t("settings.roundsBeforeLongBreak")}
          value={settings.roundsBeforeLongBreak}
          min={1}
          max={10}
          onChange={(roundsBeforeLongBreak) => update({ roundsBeforeLongBreak })}
        />
        <Number
          id="notifyBeforeEndSeconds"
          label={t("settings.notifyBeforeEnd")}
          value={settings.notifyBeforeEndSeconds}
          min={0}
          max={600}
          onChange={(notifyBeforeEndSeconds) => update({ notifyBeforeEndSeconds })}
        />
        <label className="flex items-center gap-2 self-end text-sm">
          <input
            type="checkbox"
            checked={settings.notificationsEnabled}
            onChange={(e) => update({ notificationsEnabled: e.target.checked })}
          />
          {t("settings.browserNotifications")}
        </label>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="focusDoneMessage">{t("settings.doneMessage")}</Label>
          <Input
            id="focusDoneMessage"
            value={settings.focusDoneMessage}
            onChange={(e) => update({ focusDoneMessage: e.target.value })}
            placeholder="Focus round complete on {task} — {minutes} min tracked."
          />
          <p className="text-xs text-muted-foreground">
            {t("settings.doneMessageHint")}
          </p>
        </div>
        <div className="sm:col-span-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (typeof Notification === "undefined") {
                toast.error(t("settings.notificationsUnsupported"));
                return;
              }
              void Notification.requestPermission().then((permission) =>
                permission === "granted"
                  ? toast.success(t("settings.notificationsEnabled"))
                  : toast.info(t("settings.notificationsBlocked")),
              );
            }}
          >
            {t("settings.allowNotifications")}
          </Button>
        </div>
      </div>

      <h2 className="mt-10 text-lg font-semibold">{t("settings.demoData")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("settings.demoDataSubtitle")}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy !== null} onClick={() => void seed()}>
          {busy === "seed" ? t("settings.addingDemo") : t("settings.addDemo")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={busy !== null || !hasDemoData()}
          onClick={() => void clear()}
        >
          {busy === "clear" ? t("settings.deletingDemo") : t("settings.deleteDemo")}
        </Button>
      </div>
    </div>
  );
}

function Number({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const next = globalThis.Number(e.target.value);
          if (!globalThis.isNaN(next)) onChange(Math.min(max, Math.max(min, next)));
        }}
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
      />
    </div>
  );
}


function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
