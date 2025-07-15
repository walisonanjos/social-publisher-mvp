// supabase/functions/exchange-facebook-code/index.ts
// VERSÃO CORRIGIDA - AGORA BUSCA E SALVA O ID DO INSTAGRAM

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

console.log("Função 'exchange-facebook-code' v3 (com busca de ID) INICIALIZADA.");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") { return new Response("ok", { headers: corsHeaders }); }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) throw new Error("Código ou state ausentes.");

    const { nicheId, userId } = JSON.parse(atob(state));
    console.log(`Recebida troca de código para o nicho: ${nicheId}`);

    // Etapa 1: Troca o código por um token de curta duração
    const tokenUrl = "https://graph.facebook.com/v19.0/oauth/access_token";
    const tokenParams = new URLSearchParams({
      client_id: Deno.env.get("META_APP_ID")!,
      redirect_uri: Deno.env.get("META_REDIRECT_URI")!,
      client_secret: Deno.env.get("META_APP_SECRET")!,
      code: code,
    });
    const tokenResponse = await fetch(`${tokenUrl}?${tokenParams.toString()}`);
    if (!tokenResponse.ok) { const err = await tokenResponse.text(); throw new Error(`Erro na troca de código: ${err}`); }
    const shortLivedTokenData = await tokenResponse.json();
    
    // Etapa 2: Troca o token de curta duração por um de longa duração
    const longLivedTokenUrl = "https://graph.facebook.com/v19.0/oauth/access_token";
    const longLivedParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: Deno.env.get("META_APP_ID")!,
      client_secret: Deno.env.get("META_APP_SECRET")!,
      fb_exchange_token: shortLivedTokenData.access_token,
    });
    const longLivedResponse = await fetch(`${longLivedTokenUrl}?${longLivedParams.toString()}`);
    if (!longLivedResponse.ok) { const err = await longLivedResponse.text(); throw new Error(`Erro ao buscar token de longa duração: ${err}`);}
    const longLivedTokenData = await longLivedResponse.json();
    const longLivedAccessToken = longLivedTokenData.access_token;
    console.log("Token de longa duração obtido com sucesso.");

    // --- ETAPA 3 (NOVA): BUSCAR O ID DA CONTA DO INSTAGRAM ---
    const accountsUrl = `https://graph.facebook.com/v19.0/me/accounts?fields=instagram_business_account{id,username}&access_token=${longLivedAccessToken}`;
    const accountsResponse = await fetch(accountsUrl);
    if (!accountsResponse.ok) { const err = await accountsResponse.text(); throw new Error(`Erro ao buscar contas: ${err}`);}
    const accountsData = await accountsResponse.json();

    const instagramBusinessAccount = accountsData.data.find((page: any) => page.instagram_business_account);
    if (!instagramBusinessAccount) throw new Error("Nenhuma conta de negócios do Instagram foi encontrada conectada a esta Página do Facebook.");
    
    const instagramUserId = instagramBusinessAccount.instagram_business_account.id;
    const instagramUsername = instagramBusinessAccount.instagram_business_account.username;
    console.log(`Instagram User ID encontrado: ${instagramUserId} (${instagramUsername})`);
    
    // --- Etapa 4: Salvar a conexão com o novo ID ---
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error: upsertError } = await supabaseAdmin
      .from("social_connections")
      .upsert({
        niche_id: nicheId,
        user_id: userId,
        platform: "instagram",
        access_token: longLivedAccessToken,
        provider_user_id: instagramUserId, // SALVANDO O ID CORRETO
        refresh_token: null, // Instagram não usa refresh token desta forma
      }, { onConflict: 'niche_id, platform' });

    if (upsertError) throw new Error(`Erro ao salvar os tokens no banco: ${upsertError.message}`);
    console.log(`Conexão com o Instagram salva com sucesso para o nicho ${nicheId}.`);

    const siteUrl = Deno.env.get("SITE_URL") || 'http://localhost:3000';
    return Response.redirect(`${siteUrl}/niche/${nicheId}`);

  } catch (e) {
    console.error("ERRO FINAL:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }
});