// supabase/functions/get-youtube-analytics/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

console.log("Função get-youtube-analytics v2 inicializada.");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const nicheId = url.searchParams.get("niche_id");

    if (!nicheId) {
      throw new Error("O ID do nicho (niche_id) é obrigatório.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // --- NOVA LÓGICA ADICIONADA ---
    // PASSO 1: Buscar no nosso banco os vídeos que já foram postados para este nicho.
    console.log(`Buscando vídeos postados para o nicho: ${nicheId}`);
    
    const { data: postedVideos, error: videosError } = await supabaseAdmin
      .from("videos")
      .select("youtube_video_id, title, scheduled_at")
      .eq("niche_id", nicheId)
      .eq("status", "postado")
      .not("youtube_video_id", "is", null) // Garante que só pegamos os que têm ID
      .not("youtube_video_id", "like", "fake_%"); // Ignora as simulações antigas

    if (videosError) {
      throw new Error(`Erro ao buscar vídeos no banco de dados: ${videosError.message}`);
    }

    console.log(`Encontrados ${postedVideos.length} vídeos postados.`);
    // --- FIM DA NOVA LÓGICA ---

    const responseData = {
      message: `Busca concluída para o nicho ${nicheId}.`,
      data: postedVideos, // Agora retornamos a lista de vídeos encontrados
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
    
  } catch (e) {
    console.error("Erro na função get-youtube-analytics:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});