const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Set ALLOWED_ORIGINS (comma separated, e.g. "https://app.example.com") in the
// function secrets to lock CORS down. Unset = "*" (local development only).
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allow = allowedOrigins.length === 0 ? "*" : allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    Vary: "Origin",
  };
}

// Hard limit backed by the database (check_rate_limit). Falls back to a per-isolate
// counter if the database call fails, so a DB hiccup never opens the endpoint fully.
const hits = new Map<string, number[]>();
function localLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  const blocked = recent.length >= limit;
  if (!blocked) recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  }
  return blocked;
}

async function rateLimited(key: string, limit: number, windowSeconds = 60): Promise<boolean> {
  try {
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await admin.rpc("check_rate_limit", {
      _key: `ai:${key}`,
      _limit: limit,
      _window_seconds: windowSeconds,
    });
    if (error) throw error;
    return data !== true;
  } catch (err) {
    console.error("rate limit fallback", err);
    return localLimited(key, limit, windowSeconds * 1000);
  }
}

async function getSignedInUserId(req: Request): Promise<string | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { createClient } = await import("npm:@supabase/supabase-js@2");
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await client.auth.getUser(token);
  // The anon key is a valid JWT but has no user, so it is rejected here.
  return error || !data?.user ? null : data.user.id;
}

const CATEGORIES = ["bug", "feature_request", "pricing", "support", "other"] as const;
const SENTIMENTS = ["positive", "neutral", "negative"] as const;

const SYSTEM_PROMPT = `You are an assistant for PulseDesk, a customer feedback triage tool.
Respond ONLY with valid JSON matching the requested shape. No markdown, no code fences, no extra text.`;

interface ClassifyBody {
  action: "classify";
  message: string;
}
interface SummarizeBody {
  action: "summarize";
  items: { name: string; rating: number; message: string; status: string; tags: string[] }[];
}
interface DraftBody {
  action: "draft_reply";
  customerName: string;
  rating: number;
  message: string;
}
type AiRequestBody = ClassifyBody | SummarizeBody | DraftBody;

let currentCors: Record<string, string> = {};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...currentCors, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 500) {
  return json({ error: message }, status);
}

class BadRequest extends Error {}

function str(value: unknown, max: number, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequest(`Missing ${field}.`);
  return value.slice(0, max);
}

function extractText(data: unknown): string {
  const candidates = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] }) ?? {};
  const parts = candidates.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("").trim();
}

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(stripFences(text)) as T;
  } catch {
    return null;
  }
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`Gemini error ${response.status}: ${detail.slice(0, 500)}`);
    throw new Error(`Gemini request failed with status ${response.status}`);
  }
  const data = await response.json();
  const text = extractText(data);
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

function handleClassify(body: ClassifyBody, apiKey: string) {
  const message = str(body.message, 5000, "message");
  const prompt = `Classify this customer feedback message.

Message:
"""${message}"""

Return JSON: {"category": one of ${JSON.stringify(CATEGORIES)}, "sentiment": one of ${JSON.stringify(SENTIMENTS)}}`;

  return callGemini(apiKey, prompt).then((text) => {
    const parsed = parseJson<{ category?: string; sentiment?: string }>(text);
    if (!parsed) throw new Error("Could not understand the AI response");
    const category = CATEGORIES.includes(parsed.category as never) ? parsed.category : "other";
    const sentiment = SENTIMENTS.includes(parsed.sentiment as never) ? parsed.sentiment : "neutral";
    return json({ category, sentiment });
  });
}

function handleSummarize(body: SummarizeBody, apiKey: string) {
  if (!Array.isArray(body.items) || body.items.length === 0) throw new BadRequest("Missing items.");
  const lines = body.items.slice(0, 60).map((item, i) => {
    const tagList = Array.isArray(item.tags) ? item.tags.slice(0, 10).map((t) => String(t).slice(0, 40)) : [];
    const tags = tagList.length ? ` [tags: ${tagList.join(", ")}]` : "";
    const rating = Number(item.rating) || 0;
    return `${i + 1}. (${String(item.status).slice(0, 20)}, ${rating}/5 stars) ${String(item.name ?? "").slice(0, 120)}: ${String(item.message ?? "").slice(0, 400)}${tags}`;
  });
  const prompt = `Summarize this week's customer feedback for a team lead. Write 3-5 sentences covering the main themes, overall mood, and anything urgent. Plain text only, no markdown formatting.

Feedback entries:
${lines.join("\n")}`;

  return callGemini(apiKey, prompt).then((text) => json({ summary: text }));
}

function handleDraftReply(body: DraftBody, apiKey: string) {
  const message = str(body.message, 3000, "message");
  const customerName = str(body.customerName, 120, "customerName");
  const rating = Number(body.rating) || 0;
  const mood = rating >= 4 ? "happy" : rating >= 3 ? "mixed" : "upset";
  const prompt = `Draft a short, warm reply (under 120 words) from the PulseDesk support team to this customer. The customer is ${mood} (rated us ${rating}/5). Sign off with "— The Team". Plain text only, no markdown.

Customer name: ${customerName}
Their feedback:
"""${message}"""`;

  return callGemini(apiKey, prompt).then((text) => json({ reply: text }));
}

Deno.serve(async (req: Request) => {
  currentCors = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: currentCors });
  }
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return errorResponse("The Gemini API key is not configured yet.", 503);
  }

  try {
    const body = (await req.json()) as AiRequestBody;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    switch (body?.action) {
      case "classify":
        // Public: the feedback form classifies before sign-in exists. Tight per-IP limit.
        if (await rateLimited(`classify:${ip}`, 10)) return errorResponse("Too many requests. Try again shortly.", 429);
        return await handleClassify(body, apiKey);
      case "summarize":
      case "draft_reply": {
        const userId = await getSignedInUserId(req);
        if (!userId) return errorResponse("Sign in to use this feature.", 401);
        if (await rateLimited(`user:${userId}`, 30)) return errorResponse("Too many requests. Try again shortly.", 429);
        return body.action === "summarize"
          ? await handleSummarize(body, apiKey)
          : await handleDraftReply(body, apiKey);
      }
      default:
        return errorResponse("Unknown action", 400);
    }
  } catch (err) {
    if (err instanceof BadRequest) return errorResponse(err.message, 400);
    console.error(err);
    return errorResponse("AI request failed. Please try again.");
  }
});
