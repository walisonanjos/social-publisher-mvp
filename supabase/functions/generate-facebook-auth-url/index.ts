// supabase/functions/generate-facebook-auth-url/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

console.log("Função 'generate-facebook-auth-url' inicializada.");

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
    if (userError || !user) throw new Error("Usuário não encontrado.");

    const { nicheId } = await req.json();
    if (!nicheId) throw new Error("O 'nicheId' é obrigatório.");

    // O 'state' é um parâmetro de segurança que também carrega nossos dados
    const state = {
      nicheId: nicheId,
      userId: user.id,
    };
    const encodedState = btoa(JSON.stringify(state));

    const META_APP_ID = Deno.env.get("META_APP_ID");
    const META_REDIRECT_URI = Deno.env.get("META_REDIRECT_URI");

    // Estas são as permissões que vamos solicitar ao usuário
    const scope = "pages_show_list,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish";

    const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
    authUrl.searchParams.set("client_id", META_APP_ID!);
    authUrl.searchParams.set("redirect_uri", META_REDIRECT_URI!);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("state", encodedState);

    return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Erro em generate-facebook-auth-url:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});