// supabase/functions/generate-tiktok-auth-url/index.ts

import { createClient as supabaseCreateClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { nicheId, userId } = await req.json();

    if (!nicheId || !userId) {
      throw new Error("Niche ID and User ID are required.");
    }

    const TIKTOK_CLIENT_ID = Deno.env.get("TIKTOK_CLIENT_ID");
    const TIKTOK_REDIRECT_URI = Deno.env.get("TIKTOK_REDIRECT_URI");

    if (!TIKTOK_CLIENT_ID || !TIKTOK_REDIRECT_URI) {
      throw new Error("Variáveis de ambiente TIKTOK_CLIENT_ID ou TIKTOK_REDIRECT_URI não configuradas.");
    }

    const state = btoa(JSON.stringify({ nicheId, userId, csrf: Math.random().toString(36).substring(2) }));

    // REVERTIDO: Voltando apenas para os escopos de postagem
    const tiktokAuthUrl = `https://www.tiktok.com/v2/auth/authorize?` +
      `client_key=${TIKTOK_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(TIKTOK_REDIRECT_URI)}&` +
      `response_type=code&` +
      `scope=user.info.basic,video.publish,video.upload&` +
      `state=${encodeURIComponent(state)}`;

    return new Response(JSON.stringify({ authUrl: tiktokAuthUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Erro na função generate-tiktok-auth-url:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});