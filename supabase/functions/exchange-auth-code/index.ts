// supabase/functions/exchange-auth-code/index.ts
// VERSÃO CORRIGIDA - AGORA SALVA O provider_user_id

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code) throw new Error("O 'code' de autorização não foi encontrado na URL.");
    if (!state) throw new Error("O 'state' (com niche_id e user_id) não foi encontrado na URL.");

    const { nicheId, userId } = JSON.parse(atob(state));
    
    // --- Etapa 1: Trocar o código pelo token de acesso ---
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code,
        client_id: Deno.env.get("GOOGLE_CLIENT_ID"),
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET"),
        redirect_uri: Deno.env.get("YOUTUBE_REDIRECT_URI"),
        grant_type: "authorization_code"
      })
    });
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`O Google retornou um erro durante a troca de código: ${errorText}`);
    }
    const tokens = await tokenResponse.json();
    console.log("Tokens do YouTube recebidos com sucesso.");

    // --- ETAPA 2 (NOVA): Usar o access_token para buscar o ID do Canal ---
    const channelResponse = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id&mine=true", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`
      }
    });
    if (!channelResponse.ok) {
        throw new Error("Falha ao buscar o ID do canal do YouTube.");
    }
    const channelData = await channelResponse.json();
    const youtubeChannelId = channelData.items?.[0]?.id;
    if (!youtubeChannelId) {
        throw new Error("Não foi possível extrair o ID do canal do YouTube da resposta da API.");
    }
    console.log(`ID do Canal do YouTube encontrado: ${youtubeChannelId}`);
    
    // --- Etapa 3: Salvar TUDO no banco de dados ---
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error: dbError } = await supabaseAdmin.from("social_connections").upsert({
      user_id: userId,
      niche_id: nicheId,
      platform: "youtube",
      provider_user_id: youtubeChannelId, // SALVANDO O ID CORRETO
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    }, { 
      onConflict: "niche_id, platform"
    });

    if (dbError) throw dbError;

    console.log("Conexão do YouTube salva com sucesso, incluindo o provider_user_id.");
    const siteUrl = Deno.env.get("SITE_URL") || 'http://localhost:3000';
    return Response.redirect(`${siteUrl}/niche/${nicheId}`);

  } catch (error) {
    console.error("ERRO FINAL NO BLOCO CATCH:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400
    });
  }
});