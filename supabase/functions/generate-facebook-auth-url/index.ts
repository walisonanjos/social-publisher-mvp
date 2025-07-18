// supabase/functions/generate-facebook-auth-url/index.ts
// VERSÃO FINAL com todas as permissões de publicação

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { nicheId, userId } = await req.json();
    if (!nicheId || !userId) {
      throw new Error("nicheId e userId são obrigatórios.");
    }

    const authUrl = "https://www.facebook.com/v19.0/dialog/oauth";
    const state = btoa(JSON.stringify({ nicheId, userId }));

    // --- ALTERAÇÃO FINAL AQUI ---
    const scope = [
      'public_profile',
      'pages_show_list',
      'pages_read_engagement',
      'read_insights',
      'business_management',
      'instagram_basic',
      'instagram_content_publish',
      'pages_manage_posts' // <-- ADICIONAMOS A PERMISSÃO ESSENCIAL PARA POSTAR
    ].join(',');

    const params = new URLSearchParams({
      client_id: Deno.env.get("META_APP_ID")!,
      redirect_uri: Deno.env.get("META_REDIRECT_URI")!,
      response_type: 'code',
      state: state,
      scope: scope,
    });

    const finalAuthUrl = `${authUrl}?${params.toString()}`;

    return new Response(JSON.stringify({ authUrl: finalAuthUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});