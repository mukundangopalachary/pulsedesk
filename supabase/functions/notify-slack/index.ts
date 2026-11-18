const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RATING_LABELS = ["very poor", "poor", "okay", "good", "excellent"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const payload = await req.json();
    const record = payload?.record ?? payload;
    const workspaceId = typeof record?.workspace_id === "string" ? record.workspace_id : "";
    if (!workspaceId) {
      return json({ error: "Missing workspace" }, 400);
    }

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settings } = await admin
      .from("workspace_settings")
      .select("slack_webhook_url")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    const webhookUrl = settings?.slack_webhook_url;
    if (!webhookUrl || !/^https:\/\/hooks\.slack\.com\/services\//.test(webhookUrl)) {
      return json({ skipped: true });
    }

    const rating = Number(record.rating) || 0;
    const ratingLabel = rating >= 1 && rating <= 5 ? `${rating}/5 (${RATING_LABELS[rating - 1]})` : "unrated";
    const category = record.category ? ` · ${String(record.category).replace("_", " ")}` : "";
    const sentiment = record.sentiment ? ` · ${String(record.sentiment)}` : "";
    const message = String(record.message ?? "").slice(0, 600);
    const authorName = String(record.name ?? "Anonymous customer");

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `New feedback from ${authorName} — ${ratingLabel}${category}${sentiment}\n${message}`,
      }),
    });
    if (!response.ok) {
      console.error(`Slack webhook failed with status ${response.status}`);
      return json({ error: "Slack notification failed" }, 502);
    }

    return json({ sent: true });
  } catch (err) {
    console.error(err);
    return json({ error: "Slack notification failed" }, 500);
  }
});
