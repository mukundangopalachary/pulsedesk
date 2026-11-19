const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 500) {
  return json({ error: message }, status);
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
  const message = body.message.slice(0, 5000);
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
  const lines = body.items.slice(0, 60).map((item, i) => {
    const tags = item.tags.length ? ` [tags: ${item.tags.join(", ")}]` : "";
    return `${i + 1}. (${item.status}, ${item.rating}/5 stars) ${item.name}: ${item.message.slice(0, 400)}${tags}`;
  });
  const prompt = `Summarize this week's customer feedback for a team lead. Write 3-5 sentences covering the main themes, overall mood, and anything urgent. Plain text only, no markdown formatting.

Feedback entries:
${lines.join("\n")}`;

  return callGemini(apiKey, prompt).then((text) => json({ summary: text }));
}

function handleDraftReply(body: DraftBody, apiKey: string) {
  const message = body.message.slice(0, 3000);
  const mood =
    body.rating >= 4 ? "happy" : body.rating >= 3 ? "mixed" : "upset";
  const prompt = `Draft a short, warm reply (under 120 words) from the PulseDesk support team to this customer. The customer is ${mood} (rated us ${body.rating}/5). Sign off with "— The Team". Plain text only, no markdown.

Customer name: ${body.customerName}
Their feedback:
"""${message}"""`;

  return callGemini(apiKey, prompt).then((text) => json({ reply: text }));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return errorResponse("The Gemini API key is not configured yet.", 503);
  }

  try {
    const body = (await req.json()) as AiRequestBody;

    switch (body.action) {
      case "classify":
        return await handleClassify(body, apiKey);
      case "summarize":
        return await handleSummarize(body, apiKey);
      case "draft_reply":
        return await handleDraftReply(body, apiKey);
      default:
        return errorResponse("Unknown action", 400);
    }
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "AI request failed");
  }
});
