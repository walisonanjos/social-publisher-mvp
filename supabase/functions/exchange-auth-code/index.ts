import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Log para sabermos que a versão correta foi implantada
console.log("Função 'exchange-auth-code' v2 (com logs) INICIALIZADA.");

Deno.serve(async (req) => {
  console.log("Recebida uma nova requisição para troca de código.");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, state } = await req.json();
    console.log("Dados recebidos do corpo da requisição:", {
      code: code ? "presente" : "ausente",
      state: state ? "presente" : "ausente",
    });
    if (!code || !state)
      throw new Error("Código de autorização ou estado ausentes.");

    const { nicheId, userId } = JSON.parse(state);
    console.log("Dados extraídos do 'state':", { nicheId, userId });
    if (!nicheId || !userId)
      throw new Error("Estado (state) inválido ou faltando dados.");

    // Logando as variáveis que vamos enviar para o Google
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const redirectUri = Deno.env.get("YOUTUBE_REDIRECT_URI");

    console.log("Verificando segredos para a chamada ao Google...");
    console.log("GOOGLE_CLIENT_ID:", googleClientId ? "Ok" : "FALTOU!");
    console.log("GOOGLE_CLIENT_SECRET:", googleClientSecret ? "Ok" : "FALTOU!");
    console.log("YOUTUBE_REDIRECT_URI:", redirectUri ? redirectUri : "FALTOU!");

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code,
        client_id: googleClientId!,
        client_secret: googleClientSecret!,
        redirect_uri: redirectUri!,
        grant_type: "authorization_code",
      }),
    });

    console.log("Resposta da API do Google - Status:", response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Resposta de ERRO do Google:", errorData);
      throw new Error(
        errorData.error_description || "Falha ao buscar tokens do Google",
      );
    }

    const tokens = await response.json();
    console.log("Tokens recebidos do Google com sucesso.");

    // O resto da função continua igual...
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    console.log("Salvando tokens no banco de dados...");
    const { error: dbError } = await supabaseAdmin
      .from("social_connections")
      .upsert(
        {
          user_id: userId,
          niche_id: nicheId,
          platform: "youtube",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(
            Date.now() + tokens.expires_in * 1000,
          ).toISOString(),
        },
        { onConflict: "user_id, niche_id, platform" },
      );

    if (dbError) {
      console.error("Erro ao salvar no Supabase:", dbError);
      throw dbError;
    }
    console.log("Tokens salvos com sucesso!");

    return new Response(JSON.stringify({ success: true, nicheId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("ERRO FINAL NO BLOCO CATCH:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
