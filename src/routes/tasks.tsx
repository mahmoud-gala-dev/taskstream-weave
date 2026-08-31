import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { ItemLibrary } from "@/components/item-library";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Personal Work OS" },
      {
        name: "description",
        content:
          "Every task you own in one list, independent of the tables it appears in, with status, priority and progress.",
      },
      { property: "og:title", content: "Tasks — Personal Work OS" },
      { property: "og:description", content: "All of your tasks with status and progress." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <ItemLibrary
        type="task"
        titleKey="tasks.title"
        subtitleKey="tasks.subtitle"
      />
    </AppShell>
  ),
});
