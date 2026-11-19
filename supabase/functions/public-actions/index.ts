import { createClient } from "npm:@supabase/supabase-js@2";

// Public (anonymous) write path: submit feedback, get a screenshot upload URL, vote on the roadmap.
// Optional captcha: set TURNSTILE_SECRET_KEY to enforce Cloudflare Turnstile on submit and vote.

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

let corsHeaders: Record<string, string> = {};
function setCors(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allow = allowedOrigins.length === 0 ? "*" : allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  corsHeaders = {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    Vary: "Origin",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

class HttpError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIES = ["bug", "feature_request", "pricing", "support", "other"];
const SENTIMENTS = ["positive", "neutral", "negative"];

function text(value: unknown, min: number, max: number, field: string): string {
  if (typeof value !== "string") throw new HttpError(`Missing ${field}.`);
  const v = value.trim();
  if (v.length < min || v.length > max) throw new HttpError(`Invalid ${field}.`);
  return v;
}

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function limit(key: string, max: number, windowSeconds: number) {
  const { data, error } = await admin.rpc("check_rate_limit", {
    _key: key,
    _limit: max,
    _window_seconds: windowSeconds,
  });
  if (error) {
    console.error(error);
    throw new HttpError("Please try again shortly.", 503);
  }
  if (data !== true) throw new HttpError("Too many requests. Please try again later.", 429);
}

async function verifyCaptcha(token: unknown, ip: string) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return; // captcha not configured
  if (typeof token !== "string" || !token) throw new HttpError("Please complete the captcha.", 400);
  const form = new URLSearchParams({ secret, response: token });
  if (ip !== "unknown") form.set("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const data = await res.json().catch(() => null);
  if (!data?.success) throw new HttpError("Captcha check failed. Please try again.", 400);
}

Deno.serve(async (req: Request) => {
  setCors(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const body = await req.json();

    switch (body?.action) {
      case "submit_feedback": {
        await limit(`submit:${ip}`, 10, 3600);
        await verifyCaptcha(body.captchaToken, ip);

        const workspaceId = text(body.workspaceId, 36, 36, "workspace");
        if (!UUID.test(workspaceId)) throw new HttpError("Invalid workspace.");
        const rating = Number(body.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError("Invalid rating.");
        const category = body.category == null ? null : String(body.category);
        const sentiment = body.sentiment == null ? null : String(body.sentiment);
        if (category !== null && !CATEGORIES.includes(category)) throw new HttpError("Invalid category.");
        if (sentiment !== null && !SENTIMENTS.includes(sentiment)) throw new HttpError("Invalid sentiment.");
        const screenshotPath = body.screenshotPath == null ? null : String(body.screenshotPath);
        if (screenshotPath !== null && !(screenshotPath.startsWith(`${workspaceId}/`) && screenshotPath.length < 120)) {
          throw new HttpError("Invalid screenshot.");
        }

        const id = crypto.randomUUID();
        const { error } = await admin.from("feedback").insert({
          id,
          workspace_id: workspaceId,
          name: text(body.name, 1, 120, "name"),
          email: text(body.email, 3, 254, "email"),
          rating,
          message: text(body.message, 1, 5000, "message"),
          category,
          sentiment,
          screenshot_path: screenshotPath,
        });
        if (error) {
          console.error(error);
          // The throttle trigger raises P0001 with a user-safe message.
          if (error.code === "P0001") throw new HttpError(error.message, 429);
          throw new HttpError("Your feedback could not be sent.", 400);
        }
        return json({ id });
      }

      case "upload_url": {
        await limit(`upload:${ip}`, 5, 3600);
        const workspaceId = text(body.workspaceId, 36, 36, "workspace");
        if (!UUID.test(workspaceId)) throw new HttpError("Invalid workspace.");
        const ext = ({ "image/png": "png", "image/webp": "webp", "image/jpeg": "jpg" } as Record<string, string>)[
          String(body.contentType)
        ];
        if (!ext) throw new HttpError("Screenshots must be a JPG, PNG or WebP image.");
        const { data: ws } = await admin.from("workspaces").select("id").eq("id", workspaceId).maybeSingle();
        if (!ws) throw new HttpError("Unknown workspace.", 404);

        const path = `${workspaceId}/${crypto.randomUUID()}.${ext}`;
        const { data, error } = await admin.storage.from("feedback-screenshots").createSignedUploadUrl(path);
        if (error || !data) {
          console.error(error);
          throw new HttpError("Your screenshot could not be uploaded.", 500);
        }
        return json({ path, token: data.token });
      }

      case "vote": {
        await limit(`vote:${ip}`, 60, 3600);
        await verifyCaptcha(body.captchaToken, ip);
        const feedbackId = text(body.feedbackId, 36, 36, "item");
        const voterKey = text(body.voterKey, 8, 64, "voter");
        if (!UUID.test(feedbackId)) throw new HttpError("Invalid item.");
        const { data, error } = await admin.rpc("toggle_upvote", { _feedback_id: feedbackId, _voter_key: voterKey });
        if (error || !data?.length) {
          console.error(error);
          throw new HttpError("Your vote could not be counted.", 400);
        }
        return json({ upvoted: data[0].upvoted, upvotes: Number(data[0].upvotes) });
      }

      default:
        throw new HttpError("Unknown action", 400);
    }
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error(err);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
