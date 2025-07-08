// supabase/functions/generate-youtube-auth-url/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

console.log("Função 'generate-youtube-auth-url' v3 (com btoa) INICIALIZADA.");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error("Usuário não encontrado. Acesso não autorizado.");

    const { nicheId } = await req.json();
    if (!nicheId) throw new Error("O 'nicheId' é obrigatório no corpo da requisição.");

    console.log(`Gerando URL para o usuário ${user.id} no nicho ${nicheId}.`);

    // --- CORREÇÃO IMPORTANTE APLICADA AQUI ---
    const stateObject = {
      nicheId: nicheId,
      userId: user.id,
    };
    // Codificamos o objeto state em Base64 para que ele possa ser passado na URL.
    const encodedState = btoa(JSON.stringify(stateObject));
    // --- FIM DA CORREÇÃO ---

    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const YOUTUBE_REDIRECT_URI = Deno.env.get("YOUTUBE_REDIRECT_URI");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID!);
    authUrl.searchParams.set("redirect_uri", YOUTUBE_REDIRECT_URI!);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", encodedState); // Usamos o state codificado

    return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Erro em generate-youtube-auth-url:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});