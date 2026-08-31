import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { ItemLibrary } from "@/components/item-library";

export const Route = createFileRoute("/topics")({
  head: () => ({
    meta: [
      { title: "Topics — Personal Work OS" },
      {
        name: "description",
        content:
          "Your areas of work and research as first-class topics, each with progress, documentation and time spent.",
      },
      { property: "og:title", content: "Topics — Personal Work OS" },
      { property: "og:description", content: "All of your work and research topics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <ItemLibrary
        type="topic"
        titleKey="topics.title"
        subtitleKey="topics.subtitle"
      />
    </AppShell>
  ),
});
