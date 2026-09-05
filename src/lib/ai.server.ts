/**
 * Provider-agnostic AI transport. Secrets stay on the server; the browser only
 * ever sees the parsed suggestion payload.
 *
 * Errors: throws on missing key, non-OK provider response, timeout (25s) or a
 * malformed/unparseable model reply.
 */
export type Suggestion = {
  summary: string;
  rowNames: string[];
  columnNames: string[];
  advice: string[];
};

const TIMEOUT_MS = 25_000;

export async function requestSuggestion(prompt: string): Promise<Suggestion> {
  const apiKey = (
    process.env["GEMINI_API_KEY"] ??
    process.env["GOOGLE_API_KEY"] ??
    process.env["VITE_GOOGLE_API_KEY"] ??
    ""
  ).trim();
  if (!apiKey) throw new Error("AI is not configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                summary: { type: "string" },
                rowNames: { type: "array", items: { type: "string" } },
                columnNames: { type: "array", items: { type: "string" } },
                advice: { type: "array", items: { type: "string" } },
              },
              required: ["summary", "rowNames", "columnNames", "advice"],
            },
          },
        }),
      },
    );

    if (!res.ok) throw new Error(`AI provider error (${res.status})`);
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("AI returned an empty response");
    return normalize(JSON.parse(text) as Partial<Suggestion>);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("AI request timed out");
    if (error instanceof SyntaxError) throw new Error("AI returned a malformed response");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function normalize(raw: Partial<Suggestion>): Suggestion {
  const strings = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 12) : [];
  return {
    summary: typeof raw.summary === "string" ? raw.summary : "",
    rowNames: strings(raw.rowNames),
    columnNames: strings(raw.columnNames),
    advice: strings(raw.advice),
  };
}
