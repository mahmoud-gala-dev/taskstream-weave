import { useNavigate } from "@tanstack/react-router";
import {
  ArrowUp,
  CalendarClock,
  CheckSquare,
  Copy,
  FileText,
  LayoutDashboard,
  Link2,
  Moon,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Highlighter,
  Eraser,
  StickyNote,
  Sun,
  Table2,
  Tags,
  Timer,
  Wand2,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useSettings } from "@/lib/settings-store";
import { requestPageNote } from "@/components/page-sticky-notes";
import { requestClearHighlights, requestHighlight } from "@/components/page-highlighter";
import { useT, type MessageKey } from "@/lib/i18n";

const HIGHLIGHT_COLORS = [
  { key: "color.yellow", value: "#fde047" },
  { key: "color.green", value: "#86efac" },
  { key: "color.blue", value: "#93c5fd" },
  { key: "color.pink", value: "#f9a8d4" },
  { key: "color.orange", value: "#fdba74" },
] as const satisfies ReadonlyArray<{ key: MessageKey; value: string }>;

const ROUTES = [
  { to: "/", key: "nav.dashboard", icon: LayoutDashboard },
  { to: "/tables", key: "nav.tables", icon: Table2 },
  { to: "/focus", key: "nav.pomodoro", icon: Timer },
  { to: "/assistant", key: "nav.assistant", icon: Sparkles },
  { to: "/optimizer", key: "nav.optimizer", icon: Wand2 },
  { to: "/active", key: "nav.active", icon: CalendarClock },
  { to: "/tasks", key: "nav.tasks", icon: CheckSquare },
  { to: "/topics", key: "nav.topics", icon: Tags },
  { to: "/documentation", key: "nav.documentation", icon: FileText },
  { to: "/search", key: "nav.search", icon: Search },
  { to: "/settings", key: "nav.settings", icon: SettingsIcon },
] as const satisfies ReadonlyArray<{ to: string; key: MessageKey; icon: typeof Timer }>;

/**
 * App-wide right-click menu: works on every page, on top of the local
 * section/table/cell/item menus which keep their own more specific actions.
 */
export function GlobalContextMenu({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { settings, update } = useSettings();
  const t = useT();
  const dark = settings.theme === "dark";

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
    } catch {
      toast.error(t("menu.clipboardUnavailable"));
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="min-h-screen">{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <ContextMenuLabel>{t("common.appName")}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Link2 className="me-2 size-4" /> {t("nav.goToPage")}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-52">
            {ROUTES.map(({ to, key, icon: Icon }) => (
              <ContextMenuItem key={to} onClick={() => void navigate({ to })}>
                <Icon /> {t(key)}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem onClick={() => update({ theme: dark ? "light" : "dark" })}>
          {dark ? <Sun /> : <Moon />} {dark ? t("common.lightTheme") : t("common.darkTheme")}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => update({ language: settings.language === "ar" ? "en" : "ar" })}>
          <FileText /> {settings.language === "ar" ? "English (LTR)" : "العربية (RTL)"}
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Highlighter className="me-2 size-4" /> {t("menu.highlightSelection")}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-44">
            {HIGHLIGHT_COLORS.map((color) => (
              <ContextMenuItem
                key={color.value}
                onClick={() => requestHighlight(color.value, "background")}
              >
                <span
                  aria-hidden
                  className="me-1 inline-block size-3 rounded-sm border border-border"
                  style={{ backgroundColor: color.value }}
                />
                {t(color.key)}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Highlighter className="me-2 size-4" /> {t("highlight.textColor")}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-44">
            {HIGHLIGHT_COLORS.map((color) => (
              <ContextMenuItem
                key={color.value}
                onClick={() => requestHighlight(color.value, "text")}
              >
                <span
                  aria-hidden
                  className="me-1 inline-block size-3 rounded-sm border border-border font-bold"
                  style={{ color: color.value }}
                >
                  A
                </span>
                {t(color.key)}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem onClick={requestClearHighlights}>
          <Eraser /> {t("menu.clearHighlights")}
        </ContextMenuItem>
        <ContextMenuItem onClick={requestPageNote}>
          <StickyNote /> {t("menu.addStickyNote")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => void copy(window.location.href, t("menu.linkCopied"))}>
          <Copy /> {t("menu.copyLink")}
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => void copy(window.getSelection()?.toString() ?? "", t("common.copy"))}
        >
          <Copy /> {t("common.copy")}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <ArrowUp /> {t("menu.scrollTop")}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => window.location.reload()}>
          <RefreshCw /> {t("common.reload")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
