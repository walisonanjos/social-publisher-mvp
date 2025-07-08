// supabase/functions/get-youtube-analytics/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

console.log("Função get-youtube-analytics v4 (lendo do body) INICIALIZADA.");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // CORREÇÃO: Lendo o nicheId do corpo da requisição, que é o padrão para o invoke()
    const { nicheId } = await req.json();
    if (!nicheId) {
      throw new Error("O ID do nicho (niche_id) é obrigatório no corpo da requisição.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // PASSO 1: Buscar vídeos postados no nosso banco.
    const { data: postedVideos, error: videosError } = await supabaseAdmin
      .from("videos")
      .select("youtube_video_id, title, scheduled_at, video_url")
      .eq("niche_id", nicheId)
      .eq("status", "postado")
      .not("youtube_video_id", "is", null)
      .not("youtube_video_id", "like", "fake_%");

    if (videosError) throw new Error(`Erro ao buscar vídeos: ${videosError.message}`);
    if (!postedVideos || postedVideos.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum vídeo postado encontrado para este nicho.", data: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(`Encontrados ${postedVideos.length} vídeos para buscar estatísticas.`);

    // PASSO 2: Obter um Access Token válido para falar com o YouTube
    const { data: connection } = await supabaseAdmin
      .from("social_connections")
      .select("refresh_token")
      .eq("niche_id", nicheId)
      .eq("platform", "youtube")
      .single();
    if (!connection?.refresh_token) throw new Error(`Refresh token não encontrado para o nicho ${nicheId}.`);

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
    if (!tokenResponse.ok) throw new Error("Falha ao renovar o access token do Google.");
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log("Access Token renovado com sucesso.");

    // PASSO 3: Chamar a API do YouTube para buscar as estatísticas
    const videoIds = postedVideos.map(v => v.youtube_video_id).join(',');
    console.log(`Buscando estatísticas para os IDs: ${videoIds}`);

    const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}`;
    const youtubeResponse = await fetch(youtubeApiUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!youtubeResponse.ok) throw new Error("Falha ao buscar dados da API do YouTube.");
    const youtubeData = await youtubeResponse.json();
    
    // PASSO 4: Combinar nossos dados com os dados do YouTube
    const youtubeStatsMap = new Map(youtubeData.items.map(item => [item.id, item.statistics]));
    
    const enrichedData = postedVideos.map(video => ({
      ...video,
      statistics: youtubeStatsMap.get(video.youtube_video_id) || { viewCount: 'N/A', likeCount: 'N/A', commentCount: 'N/A' },
      thumbnail: `https://i.ytimg.com/vi/${video.youtube_video_id}/mqdefault.jpg`,
    }));
    
    console.log("Dados combinados com sucesso.");

    return new Response(JSON.stringify({ data: enrichedData }), {
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