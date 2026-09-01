import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public VAPID key the browser needs to create a push subscription. */
export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => ({
  publicKey: process.env["VAPID_PUBLIC_KEY"] ?? "",
}));

const subscriptionSchema = z.object({
  ownerKey: z.string().trim().min(1).max(200),
  endpoint: z.string().url().max(1000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
});

/** Stores (or refreshes) a browser push subscription so reminders can reach a closed tab. */
export const savePushSubscription = createServerFn({ method: "POST" })
  .validator((data: unknown) => subscriptionSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(
        {
          owner_key: data.ownerKey,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
