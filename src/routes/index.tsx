import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { TodayView } from "@/components/today-view";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today — Personal Work OS" },
      {
        name: "description",
        content:
          "Start the day on one page: tasks due today, the focus timer running and every note you captured today.",
      },
      { property: "og:title", content: "Today — Personal Work OS" },
      {
        property: "og:description",
        content: "Due tasks, Pomodoro focus timer and today's notes in a single home page.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <TodayView />
    </AppShell>
  ),
});
