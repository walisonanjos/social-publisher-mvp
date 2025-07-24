// supabase/functions/exchange-tiktok-auth-code/index.ts

// CORREÇÃO: Renomeado createClient para supabaseCreateClient para evitar conflito de declaração
import { createClient as supabaseCreateClient } from "https://esm.sh/@supabase/supabase-js@2"; 

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, state } = await req.json();

    if (!code) throw new Error("O 'code' de autorização do TikTok não foi encontrado no body da requisição.");
    if (!state) throw new Error("O 'state' (com niche_id e user_id) não foi encontrado na URL.");

    const { nicheId, userId } = JSON.parse(atob(state));

    const TIKTOK_CLIENT_ID = Deno.env.get("TIKTOK_CLIENT_ID");
    const TIKTOK_CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET");
    const TIKTOK_REDIRECT_URI = Deno.env.get("TIKTOK_REDIRECT_URI"); 

    if (!TIKTOK_CLIENT_ID || !TIKTOK_CLIENT_SECRET || !TIKTOK_REDIRECT_URI) {
      throw new Error("Variáveis de ambiente TIKTOK_CLIENT_ID, TIKTOK_CLIENT_SECRET ou TIKTOK_REDIRECT_URI não configuradas.");
    }

    // --- Etapa 1: Trocar o código pelo token de acesso do TikTok ---
    const tokenResponse = await fetch("https://www.tiktok.com/v2/oauth/token/", {
      method: "POST",
      headers: { 
          "Content-Type": "application/x-www-form-urlencoded",
          // "User-Agent": "SocialPublisherMVP/1.0" // Removido na tentativa anterior
      },
      body: new URLSearchParams({
        client_key: TIKTOK_CLIENT_ID,
        client_secret: TIKTOK_CLIENT_SECRET,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: TIKTOK_REDIRECT_URI
      }).toString()
    });

    if (!tokenResponse.ok) {
      const errorResponseText = await tokenResponse.text();
      let errorMessageFromTikTok = errorResponseText;
      try {
        const errorJson = JSON.parse(errorResponseText);
        errorMessageFromTikTok = `Status: ${tokenResponse.status}. Message: ${errorJson.message || errorJson.error_description || JSON.stringify(errorJson)}`;
      } catch (parseError) {
        // Não foi JSON, usa o texto puro
      }
      console.error("ERRO API TIKTOK (troca de token):", errorMessageFromTikTok);
      throw new Error(`TikTok token exchange failed: ${errorMessageFromTikTok}`);
    }

    const tokens = await tokenResponse.json();
    console.log("Tokens do TikTok recebidos com sucesso.");

    // --- Etapa 2: Usar o access_token para buscar o user_id (open_id) do TikTok ---
    let tiktokOpenId = tokens.open_id;
    if (!tiktokOpenId) {
      console.warn("Open ID do TikTok não encontrado na resposta do token. Tentando userinfo endpoint.");
      const userInfoResponse = await fetch("https://open.tiktokapis.com/v2/user/info/", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${tokens.access_token}`,
          "Content-Type": "application/json",
          // "User-Agent": "SocialPublisherMVP/1.0" // Removido na tentativa anterior
        },
        body: JSON.stringify({
          fields: ["open_id", "display_name", "avatar_url"]
        })
      });
      if (!userInfoResponse.ok) {
        const userInfoErrorResponseText = await userInfoResponse.text();
        let userInfoErrorMessage = userInfoErrorResponseText;
        try {
          const userInfoErrorJson = JSON.parse(userInfoErrorResponseText);
          userInfoErrorMessage = `Status: ${userInfoResponse.status}. Message: ${userInfoErrorJson.data?.error?.message || JSON.stringify(userInfoErrorJson)}`;
        } catch (parseError) {
          // Não foi JSON
        }
        console.error("ERRO API TIKTOK (user info):", userInfoErrorMessage);
        throw new Error(`TikTok user info fetch failed: ${userInfoErrorMessage}`);
      }
      const userInfoData = await userInfoResponse.json();
      const extractedOpenId = userInfoData.data?.user?.open_id;
      if (!extractedOpenId) {
        throw new Error("Não foi possível extrair o Open ID do TikTok da resposta da API.");
      }
      tiktokOpenId = extractedOpenId;
    }
    console.log(`Open ID do TikTok encontrado: ${tiktokOpenId}`);

    // --- Etapa 3: Salvar no banco de dados ---
    const supabaseAdmin = supabaseCreateClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!); // CORREÇÃO: Usando supabaseCreateClient
    const { error: dbError } = await supabaseAdmin.from("social_connections").upsert({
      user_id: userId,
      niche_id: nicheId,
      platform: "tiktok",
      provider_user_id: tiktokOpenId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    }, { 
      onConflict: "niche_id, platform"
    });

    if (dbError) throw dbError;

    console.log("Conexão do TikTok salva com sucesso.");
    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200 
    });

  } catch (error: unknown) {
    const detailedErrorMessage = error instanceof Error ? error.message : String(error);
    console.error("ERRO NA EDGE FUNCTION exchange-tiktok-auth-code:", detailedErrorMessage);
    
    return new Response(JSON.stringify({ error: detailedErrorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400
    });
  }
});