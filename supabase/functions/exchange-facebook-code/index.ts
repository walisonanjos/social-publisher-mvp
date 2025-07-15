// supabase/functions/exchange-facebook-code/index.ts
// VERSÃO FINAL - Redireciona com o payload

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// ... (corsHeaders e Deno.serve) ...

// Cole todo o conteúdo daqui para baixo
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const siteUrl = Deno.env.get("SITE_URL") || 'http://localhost:3000';
  
  // Garantir que temos o state para redirecionar em caso de erro
  const { nicheId: stateNicheId } = JSON.parse(atob(state || 'e30='));
  const errorRedirectUrl = `${siteUrl}/niche/${stateNicheId}`;

  try {
    const code = url.searchParams.get("code");
    if (!code || !state) throw new Error("Código ou state ausentes.");

    const { nicheId, userId } = JSON.parse(atob(state));

    const longLivedAccessToken = await getLongLivedToken(code);
    const availableAccounts = await getAvailableAccounts(longLivedAccessToken);

    if (availableAccounts.length === 0) {
      throw new Error("Nenhuma conta de negócios do Instagram foi encontrada.");
    }

    // Se houver apenas UMA conta, podemos conectá-la diretamente
    if (availableAccounts.length === 1) {
        const account = availableAccounts[0];
        const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supabaseAdmin.from("social_connections").upsert({
            niche_id: nicheId,
            user_id: userId,
            platform: "instagram",
            access_token: longLivedAccessToken,
            provider_user_id: account.instagramUserId,
            profile_name: account.instagramUsername,
        }, { onConflict: 'niche_id, platform' });

        return Response.redirect(errorRedirectUrl); // Redireciona de volta para a página do nicho
    }

    // Se houver MÚLTIPLAS contas, preparamos os dados para a seleção no frontend
    const payload = { availableAccounts, longLivedAccessToken, nicheId, userId };
    const encodedPayload = btoa(JSON.stringify(payload));
    
    const selectionRedirectUrl = new URL(errorRedirectUrl);
    selectionRedirectUrl.searchParams.set('instagram_selection', encodedPayload);

    return Response.redirect(selectionRedirectUrl.toString());

  } catch (e) {
    console.error("ERRO FINAL:", e.message);
    const redirectWithError = new URL(errorRedirectUrl);
    redirectWithError.searchParams.set('error', encodeURIComponent(e.message));
    return Response.redirect(redirectWithError.toString());
  }
});

// Funções auxiliares para organizar o código
async function getLongLivedToken(code: string): Promise<string> {
    // ... (lógica para trocar code por token de longa duração) ...
    // Esta função é idêntica à que já tínhamos
    return "TOKEN_DE_LONGA_DURACAO"; // Substitua pela lógica real
}
async function getAvailableAccounts(accessToken: string): Promise<any[]> {
    // ... (lógica para buscar contas do Instagram) ...
    // Esta função é idêntica à que já tínhamos
    return []; // Substitua pela lógica real
}