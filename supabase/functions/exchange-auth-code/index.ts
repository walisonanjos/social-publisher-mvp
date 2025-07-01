import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors";

console.log("Função 'exchange-auth-code' INICIALIZADA.");

Deno.serve(async (req) => {
  console.log("Recebida uma nova requisição.");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, state } = await req.json();
    console.log(
      "Recebido - code:",
      code ? "sim" : "não",
      "| state:",
      state ? "sim" : "não",
    );
    if (!code || !state) throw new Error("Código ou state ausentes.");

    const { nicheId, userId } = JSON.parse(state);
    console.log("Recebido - nicheId:", nicheId, "| userId:", userId);
    if (!nicheId || !userId) throw new Error("Estado inválido.");

    // Logando as variáveis que vamos enviar para o Google
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const redirectUri = Deno.env.get("YOUTUBE_REDIRECT_URI");

    console.log(
      "Enviando para o Google - client_id:",
      googleClientId ? "ok" : "FALTOU",
    );
    console.log(
      "Enviando para o Google - client_secret:",
      googleClientSecret ? "ok" : "FALTOU",
    );
    console.log("Enviando para o Google - redirect_uri:", redirectUri);

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

    console.log("Resposta do Google - Status:", response.status);
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Resposta de erro do Google:", errorData);
      throw new Error(
        errorData.error_description || "Falha ao buscar tokens do Google",
      );
    }

    const tokens = await response.json();
    console.log("Tokens recebidos do Google com sucesso.");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    console.log("Salvando tokens no banco de dados...");
    const { error: dbError } = await supabaseAdmin
      .from("social_connections")
      .upsert({
        /* ... dados ... */
      });

    if (dbError) throw dbError;
    console.log("Tokens salvos com sucesso!");

    return new Response(JSON.stringify({ success: true, nicheId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("ERRO NO BLOCO CATCH:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
