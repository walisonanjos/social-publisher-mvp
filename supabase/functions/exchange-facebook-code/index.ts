// supabase/functions/exchange-facebook-code/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

console.log("Função 'exchange-facebook-code' inicializada.");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code) throw new Error("O 'code' de autorização não foi encontrado na requisição.");
    if (!state) throw new Error("O 'state' (com niche_id e user_id) não foi encontrado.");

    const { nicheId, userId } = JSON.parse(atob(state));
    if (!nicheId || !userId) throw new Error("Dados do 'state' são inválidos.");
    
    console.log(`Recebida troca de código para o nicho: ${nicheId}`);

    // Troca o código por um access token
    const tokenUrl = "https://graph.facebook.com/v19.0/oauth/access_token";
    const tokenParams = new URLSearchParams({
      client_id: Deno.env.get("META_APP_ID")!,
      redirect_uri: Deno.env.get("META_REDIRECT_URI")!,
      client_secret: Deno.env.get("META_APP_SECRET")!,
      code: code,
    });

    const tokenResponse = await fetch(`${tokenUrl}?${tokenParams.toString()}`);
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Resposta de erro do Facebook:", errorText);
      throw new Error(`O Facebook retornou um erro durante a troca de código: ${errorText}`);
    }
    
    const tokens = await tokenResponse.json();
    console.log("Access Token (temporário) recebido com sucesso.");

    // O ideal seria trocar este token por um de longa duração,
    // mas para o nosso MVP, vamos salvar este primeiro.
    
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Salva a nova conexão na tabela
    const { error: upsertError } = await supabaseAdmin
      .from("social_connections")
      .upsert({
        niche_id: nicheId,
        user_id: userId,
        platform: "instagram", // Vamos salvar como 'instagram' por enquanto
        access_token: tokens.access_token,
        // O Facebook não retorna um refresh_token neste fluxo, o token de longa duração é o que importa
        refresh_token: null, 
      }, { onConflict: 'niche_id, platform' });

    if (upsertError) {
      throw new Error(`Erro ao salvar os tokens no banco: ${upsertError.message}`);
    }

    console.log(`Conexão salva com sucesso para o nicho ${nicheId}.`);

    // Redireciona o usuário de volta para a página do nicho
    const siteUrl = Deno.env.get("SITE_URL") || 'https://social-publisher-mvp.vercel.app';
    return Response.redirect(`${siteUrl}/niche/${nicheId}`);

  } catch (e) {
    console.error("ERRO FINAL:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});