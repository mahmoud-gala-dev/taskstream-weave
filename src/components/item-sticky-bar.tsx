import { Pause, Play, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { elapsedSeconds, formatDuration, pauseSession, resumeSession, startSession, stopSession } from "@/lib/sessions";
import type { WorkItem, WorkSession } from "@/lib/types";
import { useT } from "@/lib/i18n";

/** Sticky header that keeps the title and the running timer visible while scrolling. */
export function ItemStickyBar({
  item,
  userId,
  open,
  totalSeconds,
  now,
}: {
  item: WorkItem;
  userId: string | null;
  open: WorkSession | null;
  totalSeconds: number;
  now: number;
}) {
  const t = useT();
  const running = open?.status === "running";
  return (
    <div className="sticky top-0 z-30 -mx-6 mb-4 border-b border-border bg-background/85 px-6 py-2 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{item.title}</p>
          <p className="text-xs text-muted-foreground">
            {open ? t("item.bar.running") : t("item.bar.idle")} ·{" "}
            <span className="font-mono" dir="ltr">
              {formatDuration(open ? elapsedSeconds(open, now) : totalSeconds)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!open ? (
            <Button
              size="sm"
              onClick={() => userId && void startSession(userId, { id: item.id, type: item.type, title: item.title })}
            >
              <Play className="size-4" /> {t("item.sessions.start")}
            </Button>
          ) : (
            <>
              {running ? (
                <Button size="sm" variant="outline" onClick={() => void pauseSession(open)}>
                  <Pause className="size-4" /> {t("item.sessions.pause")}
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => void resumeSession(open)}>
                  <Play className="size-4" /> {t("item.sessions.resume")}
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => void stopSession(open)}>
                <Square className="size-4" /> {t("item.sessions.stop")}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
