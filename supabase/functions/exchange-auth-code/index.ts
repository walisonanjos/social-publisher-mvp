import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORREÇÃO: Colamos o corsHeaders diretamente aqui
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const { code, state } = await req.json();
    if (!code) throw new Error("Authorization code is missing");
    if (!state) throw new Error("State is missing");
    const { nicheId, userId } = JSON.parse(state);
    if (!nicheId || !userId) throw new Error("Invalid state");

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code,
        client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
        redirect_uri: Deno.env.get("YOUTUBE_REDIRECT_URI")!,
        grant_type: "authorization_code",
      }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error_description || "Failed to fetch tokens");
    }
    const tokens = await response.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: dbError } = await supabaseAdmin
      .from("social_connections")
      .upsert(
        {
          user_id: userId,
          niche_id: nicheId,
          platform: "youtube",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(
            Date.now() + tokens.expires_in * 1000,
          ).toISOString(),
        },
        { onConflict: "user_id, niche_id, platform" },
      );
    if (dbError) throw dbError;

    return new Response(JSON.stringify({ success: true, nicheId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
