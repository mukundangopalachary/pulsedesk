import { createClient } from "npm:@supabase/supabase-js@2";

// Set ALLOWED_ORIGINS (comma separated) in the function secrets to lock CORS down.
// Unset = "*" (local development only).
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

Deno.serve(async (req: Request) => {
  setCors(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "");
    if (!bearer) {
      return json({ error: "Sign in to invite teammates." }, 401);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData, error: userError } = await admin.auth.getUser(bearer);
    if (userError || !userData?.user) {
      return json({ error: "Sign in to invite teammates." }, 401);
    }

    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = typeof body.role === "string" ? body.role : "";
    // Prefer a server-side APP_URL so a caller cannot make us email links to another site.
    const clientOrigin = typeof body.origin === "string" ? body.origin.replace(/\/+$/, "") : "";
    const origin = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "") ||
      (allowedOrigins.includes(clientOrigin) || allowedOrigins.length === 0 ? clientOrigin : "");
    if (!workspaceId || !email || !role) {
      return json({ error: "Choose a teammate email and role first." }, 400);
    }

    const rpcResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/create_invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({ _ws: workspaceId, _email: email, _role: role }),
    });
    const rpcText = await rpcResponse.text();
    let rpcData: unknown = null;
    try {
      rpcData = JSON.parse(rpcText);
    } catch {
      rpcData = null;
    }
    if (!rpcResponse.ok) {
      const message =
        rpcData && typeof rpcData === "object" && "message" in rpcData
          ? String((rpcData as { message: unknown }).message)
          : "The invitation could not be created.";
      return json({ error: message }, 400);
    }
    const inviteToken = typeof rpcData === "string" ? rpcData : "";
    if (!inviteToken) {
      return json({ error: "The invitation could not be created." }, 500);
    }

    const link = `${origin}/invite/${inviteToken}`;
    let sent = false;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && origin) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: "PulseDesk <onboarding@resend.dev>",
            to: [email],
            subject: "You're invited to join a workspace on PulseDesk",
            html: `<p>Hi,</p><p>You have been invited to join a team workspace on <strong>PulseDesk</strong> with the role <strong>${escapeHtml(role)}</strong>.</p><p><a href="${link}">Accept your invitation</a></p><p>This link expires in 7 days. Accept it while signed in as ${escapeHtml(email)}.</p>`,
          }),
        });
        sent = emailResponse.ok;
        if (!sent) console.error(`Invite email failed with status ${emailResponse.status}`);
      } catch (emailErr) {
        console.error(emailErr);
      }
    }

    return json({ sent, link });
  } catch (err) {
    console.error(err);
    return json({ error: "The invitation could not be sent." }, 500);
  }
});
