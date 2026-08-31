import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  buildPrompt,
  buildWorkspacePrompt,
  type OptimizeInput,
  type WorkspaceInput,
} from "@/lib/ai-prompt";
import { requestSuggestion } from "@/lib/ai.server";

const schema = z.object({
  goal: z.string().trim().min(3).max(500),
  tableName: z.string().trim().max(120).default(""),
  existingRows: z.array(z.string().max(120)).max(50).default([]),
  existingColumns: z.array(z.string().max(120)).max(50).default([]),
});

export const optimizeTable = createServerFn({ method: "POST" })
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => requestSuggestion(buildPrompt(data as OptimizeInput)));

const workspaceSchema = z.object({
  goal: z.string().trim().max(500).default(""),
  openTasks: z
    .array(
      z.object({
        title: z.string().max(200),
        status: z.string().max(40),
        priority: z.string().max(40),
        progress: z.number().min(0).max(100),
      }),
    )
    .max(60)
    .default([]),
  topics: z.array(z.string().max(200)).max(60).default([]),
  cellNotes: z.array(z.string().max(300)).max(60).default([]),
});

export const optimizeWorkspace = createServerFn({ method: "POST" })
  .validator((data: unknown) => workspaceSchema.parse(data))
  .handler(async ({ data }) => requestSuggestion(buildWorkspacePrompt(data as WorkspaceInput)));
