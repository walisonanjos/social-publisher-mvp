// supabase/functions/get-youtube-analytics/index.ts
// v13 - Versão final com validação de IDs de vídeo via regex

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

console.log("Função get-youtube-analytics (v13-final) INICIALIZADA.");

// Expressão regular para validar um ID de vídeo do YouTube
const youtubeVideoIdRegex = /^[a-zA-Z0-9_-]{11}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { nicheId } = await req.json();
    if (!nicheId) throw new Error("O ID do nicho é obrigatório.");
    console.log(`[1/6] Iniciando análise para o nicho: ${nicheId}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: postedVideos, error: videosError } = await supabaseAdmin
      .from("videos")
      .select("youtube_video_id, title, scheduled_at")
      .eq("niche_id", nicheId)
      .eq("youtube_status", "publicado")
      .not("youtube_video_id", "is", null);

    if (videosError) {
      console.error("ERRO ao buscar vídeos no Supabase:", videosError);
      throw videosError;
    }

    if (!postedVideos || postedVideos.length === 0) {
      console.log("[2/6] Nenhum vídeo com 'youtube_status=publicado' encontrado. Finalizando com sucesso.");
      return new Response(JSON.stringify({ data: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(`[2/6] Encontrados ${postedVideos.length} vídeos para analisar.`);

    const { data: connection } = await supabaseAdmin
      .from("social_connections")
      .select("refresh_token")
      .eq("niche_id", nicheId)
      .eq("platform", "youtube")
      .maybeSingle();

    if (!connection?.refresh_token) {
      throw new Error(`[ERRO] Refresh token do YouTube não encontrado para o nicho ${nicheId}.`);
    }
    console.log("[3/6] Conexão do YouTube encontrada. Renovando token de acesso...");

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: Deno.env.get("GOOGLE_CLIENT_ID"),
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET"),
        refresh_token: connection.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`[ERRO] Falha ao renovar o access token do Google: ${errorText}`);
    }
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log("[4/6] Token de acesso renovado com sucesso.");

    // CORREÇÃO FINAL AQUI: Filtra IDs de vídeos que são válidos com regex
    const validVideoIds = postedVideos
        .map(v => v.youtube_video_id)
        .filter(id => id && typeof id === 'string' && youtubeVideoIdRegex.test(id))
        .join(',');
    
    if (!validVideoIds) {
        console.log("[5/6] Nenhum ID de vídeo válido encontrado para busca. Retornando dados crus.");
        return new Response(JSON.stringify({ data: postedVideos }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    }

    const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${validVideoIds}`;
    console.log(`[5/6] Buscando dados da API do YouTube para os IDs: ${validVideoIds}`);

    const youtubeResponse = await fetch(youtubeApiUrl, { headers: { Authorization: `Bearer ${accessToken}` } });

    if (!youtubeResponse.ok) {
      const errorText = await youtubeResponse.text();
      throw new Error(`[ERRO] Falha ao buscar dados da API do YouTube: ${errorText}`);
    }

    const youtubeData = await youtubeResponse.json();
    if (!youtubeData || !Array.isArray(youtubeData.items)) {
        throw new Error("[ERRO] A resposta da API do YouTube não continha um array 'items'.");
    }

    const youtubeDataMap = new Map(youtubeData.items.map((item: any) => [item.id, item]));

    const enrichedData = postedVideos.map(video => {
      const ytData = youtubeDataMap.get(video.youtube_video_id);
      return {
        ...video,
        statistics: ytData?.statistics || { viewCount: '0', likeCount: '0', commentCount: '0' },
        thumbnail: ytData?.snippet?.thumbnails?.medium?.url || ytData?.snippet?.thumbnails?.default?.url || ''
      };
    });
    console.log("[6/6] Dados enriquecidos com sucesso. Retornando resposta.");

    return new Response(JSON.stringify({ data: enrichedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (e) {
    console.error("ERRO FATAL NA FUNÇÃO:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});