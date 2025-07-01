// supabase/functions/generate-youtube-auth-url/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// CORREÇÃO: Removida a extensão .ts do import
import { corsHeaders } from "../_shared/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not found");
    const { nicheId } = await req.json();
    if (!nicheId) throw new Error("nicheId is required");
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const redirectUri = Deno.env.get("YOUTUBE_REDIRECT_URI");
    const scope = "https://www.googleapis.com/auth/youtube.upload";
    const state = JSON.stringify({ nicheId, userId: user.id });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams(
      {
        client_id: googleClientId!,
        redirect_uri: redirectUri!,
        response_type: "code",
        scope: scope,
        access_type: "offline",
        prompt: "consent",
        state: state,
      },
    ).toString()}`;
    return new Response(JSON.stringify({ authUrl }), {
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
