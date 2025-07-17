// supabase/functions/exchange-facebook-code/index.ts
// VERSÃO OTIMIZADA - REMOVE CHAMADA DE DIAGNÓSTICO

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Funções auxiliares para organizar o código ---

// Troca o código de autorização por um token de longa duração
async function getLongLivedToken(code: string): Promise<string> {
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
  
  console.log("Token de longa duração obtido com sucesso.");
  return longLivedTokenData.access_token;
}

// Busca as contas de Instagram disponíveis
async function getAvailableAccounts(accessToken: string): Promise<any[]> {
    const accountsUrl = `https://graph.facebook.com/v19.0/me/accounts?fields=name,instagram_business_account{id,username,profile_picture_url}&access_token=${accessToken}`;
    const accountsResponse = await fetch(accountsUrl);
    if (!accountsResponse.ok) { const err = await accountsResponse.text(); throw new Error(`Erro ao buscar contas: ${err}`);}
    const accountsData = await accountsResponse.json();

    const availableAccounts = accountsData.data
      .filter((page: any) => page.instagram_business_account)
      .map((page: any) => ({
        pageName: page.name,
        instagramUserId: page.instagram_business_account.id,
        instagramUsername: page.instagram_business_account.username,
        instagramProfilePicture: page.instagram_business_account.profile_picture_url,
      }));
    return availableAccounts;
}


// --- Função Principal ---
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const siteUrl = Deno.env.get("SITE_URL") || 'http://localhost:3000';
  
  const { nicheId: stateNicheId, userId: stateUserId } = JSON.parse(atob(state || 'e30='));
  const redirectBaseUrl = `${siteUrl}/niche/${stateNicheId}`;

  try {
    const code = url.searchParams.get("code");
    if (!code || !state) throw new Error("Código ou state ausentes na URL de retorno.");

    const longLivedAccessToken = await getLongLivedToken(code);
    const availableAccounts = await getAvailableAccounts(longLivedAccessToken);

    if (availableAccounts.length === 0) {
      throw new Error("Nenhuma conta de negócios do Instagram foi encontrada conectada a nenhuma de suas Páginas do Facebook. Verifique suas configurações no Meta Business Suite.");
    }

    if (availableAccounts.length === 1) {
        const account = availableAccounts[0];
        const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supabaseAdmin.from("social_connections").upsert({
            niche_id: stateNicheId,
            user_id: stateUserId,
            platform: "instagram",
            access_token: longLivedAccessToken,
            provider_user_id: account.instagramUserId,
            profile_name: account.instagramUsername,
        }, { onConflict: 'niche_id, platform' });

        return Response.redirect(redirectBaseUrl);
    }

    const payload = { availableAccounts, longLivedAccessToken, nicheId: stateNicheId, userId: stateUserId };
    const encodedPayload = btoa(JSON.stringify(payload));
    
    const selectionRedirectUrl = new URL(redirectBaseUrl);
    selectionRedirectUrl.searchParams.set('instagram_selection', encodedPayload);

    return Response.redirect(selectionRedirectUrl.toString());

  } catch (e) {
    console.error("ERRO FINAL no exchange-facebook-code:", e.message);
    const redirectWithError = new URL(redirectBaseUrl);
    redirectWithError.searchParams.set('error', encodeURIComponent(e.message));
    return Response.redirect(redirectWithError.toString());
  }
});