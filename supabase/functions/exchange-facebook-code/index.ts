// supabase/functions/exchange-facebook-code/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { /* ... */ };

console.log("Função 'exchange-facebook-code' v2 (com busca de ID) INICIALIZADA.");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") { return new Response("ok", { headers: corsHeaders }); }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) throw new Error("Código ou state ausentes.");

    const { nicheId, userId } = JSON.parse(atob(state));
    console.log(`Recebida troca de código para o nicho: ${nicheId}`);

    // Troca o código por um access token de curta duração
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
    
    // Troca o token de curta duração por um de longa duração
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

    // --- NOVA LÓGICA: BUSCAR O ID DA CONTA DO INSTAGRAM ---
    const accountsUrl = `https://graph.facebook.com/v19.0/me/accounts?fields=instagram_business_account{id,username}&access_token=${longLivedAccessToken}`;
    const accountsResponse = await fetch(accountsUrl);
    if (!accountsResponse.ok) { const err = await accountsResponse.text(); throw new Error(`Erro ao buscar contas: ${err}`);}
    const accountsData = await accountsResponse.json();

    // Pega o ID da primeira conta do Instagram que o usuário conectou
    const instagramBusinessAccount = accountsData.data.find((page: any) => page.instagram_business_account);
    if (!instagramBusinessAccount) throw new Error("Nenhuma conta de negócios do Instagram foi encontrada conectada a esta Página do Facebook.");
    
    const instagramUserId = instagramBusinessAccount.instagram_business_account.id;
    const instagramUsername = instagramBusinessAccount.instagram_business_account.username;
    console.log(`Instagram User ID encontrado: ${instagramUserId} (${instagramUsername})`);
    // --- FIM DA NOVA LÓGICA ---

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Salva a conexão com o novo ID do provedor
    const { error: upsertError } = await supabaseAdmin
      .from("social_connections")
      .upsert({
        niche_id: nicheId,
        user_id: userId,
        platform: "instagram",
        access_token: longLivedAccessToken,
        provider_user_id: instagramUserId, // Salvando o ID do Instagram
        refresh_token: null, 
      }, { onConflict: 'niche_id, platform' });

    if (upsertError) throw new Error(`Erro ao salvar os tokens no banco: ${upsertError.message}`);
    console.log(`Conexão com o Instagram salva com sucesso para o nicho ${nicheId}.`);

    const siteUrl = Deno.env.get("SITE_URL") || 'https://social-publisher-mvp.vercel.app';
    return Response.redirect(`${siteUrl}/niche/${nicheId}`);

  } catch (e) {
    console.error("ERRO FINAL:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }
});