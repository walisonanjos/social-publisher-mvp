// supabase/functions/exchange-tiktok-auth-code/index.ts

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

    if (!code) throw new Error("O 'code' de autorização do TikTok não foi encontrado na URL.");
    if (!state) throw new Error("O 'state' (com niche_id e user_id) não foi encontrado na URL.");

    // O state é base64 encoded do frontend
    const { nicheId, userId } = JSON.parse(atob(state));

    // Variáveis de ambiente do TikTok
    const TIKTOK_CLIENT_ID = Deno.env.get("TIKTOK_CLIENT_ID");
    const TIKTOK_CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET");
    const TIKTOK_REDIRECT_URI = Deno.env.get("TIKTOK_REDIRECT_URI"); // Agora aponta para esta Edge Function

    if (!TIKTOK_CLIENT_ID || !TIKTOK_CLIENT_SECRET || !TIKTOK_REDIRECT_URI) {
      throw new Error("Variáveis de ambiente TIKTOK_CLIENT_ID, TIKTOK_CLIENT_SECRET ou TIKTOK_REDIRECT_URI não configuradas.");
    }

    // --- Etapa 1: Trocar o código pelo token de acesso do TikTok ---
    const tokenResponse = await fetch("https://www.tiktok.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" }, // TikTok exige form-urlencoded
      body: new URLSearchParams({
        client_key: TIKTOK_CLIENT_ID,
        client_secret: TIKTOK_CLIENT_SECRET,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: TIKTOK_REDIRECT_URI // Deve ser a URL desta Edge Function
      }).toString()
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json(); // TikTok retorna JSON em caso de erro
      console.error("Erro na troca de código do TikTok:", errorData);
      throw new Error(`O TikTok retornou um erro durante a troca de código: ${errorData.message || errorData.error_description || JSON.stringify(errorData)}`);
    }

    const tokens = await tokenResponse.json();
    console.log("Tokens do TikTok recebidos com sucesso.");

    // --- Etapa 2: Usar o access_token para buscar o user_id (open_id) do TikTok ---
    // A documentação do TikTok indica que o open_id vem na resposta do token endpoint.
    // Se não vier, uma chamada adicional para /oauth/userinfo/ pode ser necessária.
    const tiktokOpenId = tokens.open_id; // open_id é o ID do usuário TikTok
    if (!tiktokOpenId) {
      console.warn("Open ID do TikTok não encontrado na resposta do token. Tentando userinfo endpoint.");
      const userInfoResponse = await fetch("https://open.tiktokapis.com/v2/user/info/", { // Endpoint de userinfo
        method: "POST", // A documentação indica POST
        headers: {
          "Authorization": `Bearer ${tokens.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fields: ["open_id", "display_name", "avatar_url"] // Campos que você pode querer, open_id é crucial
        })
      });
      if (!userInfoResponse.ok) {
        const userInfoError = await userInfoResponse.json();
        throw new Error(`Falha ao buscar user info do TikTok: ${userInfoError.data?.error?.message || JSON.stringify(userInfoError)}`);
      }
      const userInfoData = await userInfoResponse.json();
      const extractedOpenId = userInfoData.data?.user?.open_id; // Caminho para o open_id na resposta
      if (!extractedOpenId) {
        throw new Error("Não foi possível extrair o Open ID do TikTok da resposta da API.");
      }
      tiktokOpenId = extractedOpenId;
    }
    console.log(`Open ID do TikTok encontrado: ${tiktokOpenId}`);

    // --- Etapa 3: Salvar no banco de dados ---
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error: dbError } = await supabaseAdmin.from("social_connections").upsert({
      user_id: userId,
      niche_id: nicheId,
      platform: "tiktok", // Plataforma é 'tiktok'
      provider_user_id: tiktokOpenId, // O ID único do usuário TikTok
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null, // refresh_token pode não vir para todos os grants
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    }, { 
      onConflict: "niche_id, platform"
    });

    if (dbError) throw dbError;

    console.log("Conexão do TikTok salva com sucesso.");
    const siteUrl = Deno.env.get("SITE_URL") || 'http://localhost:3000';
    return Response.redirect(`${siteUrl}/niche/${nicheId}`);

  } catch (error: any) { // Adicionado 'any' para o tipo de exceção
    console.error("ERRO FINAL NA EDGE FUNCTION exchange-tiktok-auth-code:", error.message);
    const siteUrl = Deno.env.get("SITE_URL") || 'http://localhost:3000';
    // Redireciona de volta para o frontend com um parâmetro de erro
    return Response.redirect(`${siteUrl}/niche/${nicheId}?error=tiktok_oauth_failed&message=${encodeURIComponent(error.message)}`, 302);
  }
});