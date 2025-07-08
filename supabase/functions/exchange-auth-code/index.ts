// supabase/functions/exchange-auth-code/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

console.log("Função 'exchange-auth-code' v4 (versão correta) INICIALIZADA.");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // CORREÇÃO: Lendo 'code' e 'state' da URL, não do corpo da requisição.
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code) throw new Error("O 'code' de autorização não foi encontrado na URL.");
    if (!state) throw new Error("O 'state' (com niche_id e user_id) não foi encontrado na URL.");
    
    // O 'state' vem codificado em Base64, precisamos decodificá-lo
    const { nicheId, userId } = JSON.parse(atob(state));
    console.log(`Recebida troca de código para o nicho: ${nicheId}`);

    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const YOUTUBE_REDIRECT_URI = Deno.env.get("YOUTUBE_REDIRECT_URI");

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: YOUTUBE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Resposta de erro do Google:", errorText);
      throw new Error(`O Google retornou um erro durante a troca de código: ${errorText}`);
    }

    const tokens = await response.json();
    console.log("Tokens recebidos com sucesso.");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: dbError } = await supabaseAdmin
      .from("social_connections")
      .upsert(
        {
          user_id: userId,
          niche_id: nicheId,
          platform: "youtube",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        },
        // A regra de conflito correta é garantir uma conexão por plataforma em cada nicho
        { onConflict: "niche_id, platform" },
      );

    if (dbError) {
      console.error("Erro ao salvar no Supabase:", dbError);
      throw dbError;
    }
    console.log("Tokens salvos com sucesso!");
    
    // CORREÇÃO: Redireciona o usuário de volta para a página do nicho no seu site
    const siteUrl = Deno.env.get("SITE_URL") || 'https://social-publisher-mvp.vercel.app'; // URL de fallback
    return Response.redirect(`${siteUrl}/niche/${nicheId}`);

  } catch (error) {
    console.error("ERRO FINAL NO BLOCO CATCH:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});