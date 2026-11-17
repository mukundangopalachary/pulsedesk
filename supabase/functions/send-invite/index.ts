import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    const origin = typeof body.origin === "string" ? body.origin.replace(/\/+$/, "") : "";
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
            html: `<p>Hi,</p><p>You have been invited to join a team workspace on <strong>PulseDesk</strong> with the role <strong>${role}</strong>.</p><p><a href="${link}">Accept your invitation</a></p><p>This link expires in 7 days. Accept it while signed in as ${email}.</p>`,
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
    return json({ error: err instanceof Error ? err.message : "The invitation could not be sent." }, 500);
  }
});
