import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { TodayView } from "@/components/today-view";

export const Route = createFileRoute("/today")({
  head: () => ({
    meta: [
      { title: "Today — Personal Work OS" },
      {
        name: "description",
        content: "Due tasks, your focus timer and today's notes together on one page.",
      },
      { property: "og:title", content: "Today — Personal Work OS" },
      {
        property: "og:description",
        content: "One page for what is due today, the Pomodoro timer and today's captured notes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <TodayView />
    </AppShell>
  ),
});
