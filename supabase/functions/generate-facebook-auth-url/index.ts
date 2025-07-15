// supabase/functions/generate-facebook-auth-url/index.ts
// VERSÃO CORRIGIDA - COM TODAS AS PERMISSÕES (SCOPES)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { nicheId, userId } = await req.json();
    if (!nicheId || !userId) {
      throw new Error("nicheId e userId são obrigatórios.");
    }

    const authUrl = "https://www.facebook.com/v19.0/dialog/oauth";
    
    // String de estado para segurança e para passar dados
    const state = btoa(JSON.stringify({ nicheId, userId }));

    // --- CORREÇÃO PRINCIPAL AQUI ---
    // Definimos todas as permissões que nosso aplicativo precisa.
    const scope = [
      'public_profile',
      'pages_show_list',
      'pages_read_engagement',
      'instagram_basic',
      'instagram_content_publish',
      'business_management'
    ].join(',');

    const params = new URLSearchParams({
      client_id: Deno.env.get("META_APP_ID")!,
      redirect_uri: Deno.env.get("META_REDIRECT_URI")!,
      response_type: 'code',
      state: state,
      scope: scope, // Adicionamos as permissões à URL
    });

    const finalAuthUrl = `${authUrl}?${params.toString()}`;

    return new Response(JSON.stringify({ authUrl: finalAuthUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});