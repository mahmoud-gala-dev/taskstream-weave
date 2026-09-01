/**
 * Minimal Web Push (VAPID) sender that works in the edge runtime.
 *
 * We deliberately send *payload-less* pushes: the notification body is built
 * inside the service worker from the reminder schedule it already mirrors in
 * IndexedDB. That keeps the wire format simple (no aes128gcm payload
 * encryption) while still waking the browser when the app is closed.
 */

function b64urlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToB64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  view.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function jsonToB64url(value: unknown): string {
  return bytesToB64url(new TextEncoder().encode(JSON.stringify(value)));
}

async function vapidHeader(audience: string): Promise<string> {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"] ?? "mailto:notifications@example.com";
  if (!publicKey || !privateKey) throw new Error("VAPID keys are not configured");

  const header = jsonToB64url({ typ: "JWT", alg: "ES256" });
  const body = jsonToB64url({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  });
  const key = await crypto.subtle.importKey(
    "pkcs8",
    b64urlToBytes(privateKey) as unknown as ArrayBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(`${header}.${body}`) as unknown as ArrayBuffer,
  );
  return `vapid t=${header}.${body}.${bytesToB64url(signature)}, k=${publicKey}`;
}

/** Sends one wake-up push. Returns the endpoint status so dead subscriptions can be pruned. */
export async function sendWakeupPush(endpoint: string, ttlSeconds = 3600): Promise<number> {
  const audience = new URL(endpoint).origin;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidHeader(audience),
      TTL: String(ttlSeconds),
      Urgency: "high",
      "Content-Length": "0",
    },
  });
  return response.status;
}
