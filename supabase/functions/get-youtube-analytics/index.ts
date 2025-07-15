// supabase/functions/get-youtube-analytics/index.ts
// v9 - Diagnóstico com chamadas individuais à API

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { nicheId } = await req.json();
    if (!nicheId) throw new Error("O ID do nicho é obrigatório.");

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: postedVideos, error: videosError } = await supabaseAdmin
      .from("videos")
      .select("youtube_video_id, title, scheduled_at")
      .eq("niche_id", nicheId)
      .eq("status", "postado")
      .not("youtube_video_id", "is", null);

    if (videosError) throw videosError;
    if (!postedVideos || postedVideos.length === 0) {
      return new Response(JSON.stringify({ data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: connection } = await supabaseAdmin
      .from("social_connections")
      .select("refresh_token")
      .eq("niche_id", nicheId)
      .eq("platform", "youtube")
      .single();

    if (!connection?.refresh_token) throw new Error(`Refresh token não encontrado para o YouTube neste nicho.`);

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_id: Deno.env.get("GOOGLE_CLIENT_ID"),
            client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET"),
            refresh_token: connection.refresh_token,
            grant_type: "refresh_token"
        })
    });
    if (!tokenResponse.ok) {
        const err = await tokenResponse.json();
        throw new Error(err.error_description || "Erro ao renovar token");
    }
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    console.log(`Iniciando busca individual para ${postedVideos.length} vídeos.`);

    const enrichedDataPromises = postedVideos.map(async (video) => {
      if (!video.youtube_video_id) {
        return { ...video, statistics: { viewCount: 0, likeCount: 0, commentCount: 0 }, thumbnail: '' };
      }

      try {
        const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${video.youtube_video_id}`;
        const youtubeResponse = await fetch(youtubeApiUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!youtubeResponse.ok) {
          console.error(`Falha na API para o ID: ${video.youtube_video_id}`);
          return { ...video, statistics: { viewCount: 0, likeCount: 0, commentCount: 0 }, thumbnail: '' };
        }

        const youtubeData = await youtubeResponse.json();

        if (youtubeData.items && youtubeData.items.length > 0) {
          const item = youtubeData.items[0];
          console.log(`SUCESSO ao buscar dados para o ID: ${video.youtube_video_id}`);
          return {
            ...video,
            statistics: item.statistics || { viewCount: 0, likeCount: 0, commentCount: 0 },
            thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || ''
          };
        } else {
          console.log(`AVISO: Nenhum item retornado pela API para o ID: ${video.youtube_video_id}`);
          return { ...video, statistics: { viewCount: 0, likeCount: 0, commentCount: 0 }, thumbnail: '' };
        }
      } catch (e) {
        console.error(`ERRO no fetch para o ID ${video.youtube_video_id}:`, e.message);
        return { ...video, statistics: { viewCount: 0, likeCount: 0, commentCount: 0 }, thumbnail: '' };
      }
    });

    const enrichedData = await Promise.all(enrichedDataPromises);

    return new Response(JSON.stringify({ data: enrichedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (e) {
    console.error("Erro pego no bloco catch final:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});