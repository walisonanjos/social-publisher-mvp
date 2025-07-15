// supabase/functions/finalize-instagram-connection/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

console.log("Função 'finalize-instagram-connection' inicializada.");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Recebemos a escolha final do frontend
    const {
      nicheId,
      userId,
      selectedAccount,
      longLivedAccessToken
    } = await req.json();

    if (!nicheId || !userId || !selectedAccount || !longLivedAccessToken) {
      throw new Error("Dados insuficientes para finalizar a conexão.");
    }

    const { instagramUserId, instagramUsername } = selectedAccount;

    if (!instagramUserId) {
      throw new Error("ID da conta do Instagram não foi fornecido na seleção.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Usamos o 'upsert' para salvar a conexão definitiva no banco de dados
    const { error: upsertError } = await supabaseAdmin
      .from("social_connections")
      .upsert({
        niche_id: nicheId,
        user_id: userId,
        platform: "instagram",
        access_token: longLivedAccessToken,
        provider_user_id: instagramUserId,
        profile_name: instagramUsername, // Salvando também o @ do usuário
        refresh_token: null,
      }, { onConflict: 'niche_id, platform' });

    if (upsertError) {
      throw new Error(`Erro ao salvar a conexão final no banco: ${upsertError.message}`);
    }

    console.log(`Conexão finalizada e salva para o nicho ${nicheId}`);

    return new Response(
      JSON.stringify({ success: true, message: "Conexão com Instagram finalizada!" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (e) {
    console.error("ERRO:", e.message);
    return new Response(
      JSON.stringify({ error: e.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});