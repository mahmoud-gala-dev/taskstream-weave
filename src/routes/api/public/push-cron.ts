import { createFileRoute } from "@tanstack/react-router";

import { sendWakeupPush } from "@/lib/push.server";

/**
 * Wakes every registered device so its service worker can surface due
 * reminders (overdue focus rounds / due dates) even when the app is closed.
 * Call it on a schedule with the shared secret header.
 */
export const Route = createFileRoute("/api/public/push-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PUSH_CRON_SECRET"];
        if (!secret || request.headers.get("x-cron-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("push_subscriptions")
          .select("endpoint")
          .limit(1000);
        if (error) return new Response(error.message, { status: 500 });

        const rows = data ?? [];
        const gone: string[] = [];
        let sent = 0;
        await Promise.all(
          rows.map(async (row) => {
            try {
              const status = await sendWakeupPush(row.endpoint);
              if (status === 404 || status === 410) gone.push(row.endpoint);
              else if (status < 300) sent += 1;
            } catch {
              /* transient endpoint failure — retried on the next run */
            }
          }),
        );
        if (gone.length) {
          await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", gone);
        }

        return Response.json({ devices: rows.length, sent, pruned: gone.length });
      },
    },
  },
});
