import { useNavigate } from "@tanstack/react-router";
import { BellRing } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { completedRoundsForItem } from "@/lib/sessions";
import { useWorkspace } from "@/lib/workspace-store";

const SEEN_KEY = "work-os:reminder-inbox-seen";

/**
 * Collected reminders shown once per app launch. Anything that came due while
 * the app was closed (including push wake-ups) lands here instead of only on
 * the Today page.
 */
export function ReminderInbox() {
  const t = useT();
  const navigate = useNavigate();
  const { items, sessions } = useWorkspace();
  const [open, setOpen] = useState(false);

  const overdue = useMemo(() => {
    const now = Date.now();
    return items
      .filter((i) => i.type === "task" && i.status !== "done" && !i.archivedAt && i.dueDate && i.dueDate <= now)
      .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0))
      .slice(0, 8)
      .map((item) => ({
        item,
        left: Math.max(0, (item.estimatedRounds ?? 0) - completedRoundsForItem(sessions, item.id)),
      }));
  }, [items, sessions]);

  useEffect(() => {
    if (!overdue.length || typeof window === "undefined") return;
    if (window.sessionStorage.getItem(SEEN_KEY)) return;
    window.sessionStorage.setItem(SEEN_KEY, "1");
    setOpen(true);
  }, [overdue.length]);

  if (!overdue.length) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="size-5 text-amber-500" /> {t("inbox.title")}
          </DialogTitle>
          <DialogDescription>{t("inbox.subtitle")}</DialogDescription>
        </DialogHeader>
        <ul className="max-h-72 space-y-2 overflow-y-auto">
          {overdue.map(({ item, left }) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-lg border border-s-4 border-s-amber-500/70 bg-card/70 p-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t("inbox.overdue", { date: new Date(item.dueDate ?? 0).toLocaleString() })}
                  {left ? ` · ${t("inbox.roundsLeft", { count: left })}` : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  void navigate({ to: "/item/$itemId", params: { itemId: item.id } });
                }}
              >
                {t("inbox.open")}
              </Button>
            </li>
          ))}
        </ul>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              setOpen(false);
              void navigate({ to: "/today" });
            }}
          >
            {t("inbox.goToday")}
          </Button>
          <Button onClick={() => setOpen(false)}>{t("inbox.dismiss")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
