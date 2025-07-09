// supabase/functions/get-youtube-analytics/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

console.log("Função get-youtube-analytics v5 (com thumbnail da API) INICIALIZADA.");

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
      .select("youtube_video_id, title, scheduled_at, video_url")
      .eq("niche_id", nicheId)
      .eq("status", "postado")
      .not("youtube_video_id", "is", null)
      .not("youtube_video_id", "like", "fake_%");

    if (videosError) throw videosError;
    if (!postedVideos || postedVideos.length === 0) {
      return new Response(JSON.stringify({ data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: connection } = await supabaseAdmin.from("social_connections").select("refresh_token").eq("niche_id", nicheId).single();
    if (!connection?.refresh_token) throw new Error(`Refresh token não encontrado para o nicho ${nicheId}.`);

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: Deno.env.get("GOOGLE_CLIENT_ID"), client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET"), refresh_token: connection.refresh_token, grant_type: "refresh_token" }) });
    if (!tokenResponse.ok) throw new Error("Falha ao renovar o access token.");
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    const videoIds = postedVideos.map(v => v.youtube_video_id).join(',');
    const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}`;
    const youtubeResponse = await fetch(youtubeApiUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!youtubeResponse.ok) throw new Error("Falha ao buscar dados da API do YouTube.");
    
    const youtubeData = await youtubeResponse.json();
    
    // Mapeia os dados do YouTube por ID para fácil acesso
    const youtubeDataMap = new Map(youtubeData.items.map(item => [item.id, {
        statistics: item.statistics,
        snippet: item.snippet
    }]));
    
    // Combina nossos dados com os do YouTube, agora pegando a thumbnail da API
    const enrichedData = postedVideos.map(video => {
      const ytData = youtubeDataMap.get(video.youtube_video_id);
      return {
        ...video,
        statistics: ytData?.statistics || { viewCount: 'N/A', likeCount: 'N/A', commentCount: 'N/A' },
        // --- CORREÇÃO PRINCIPAL AQUI ---
        // Pegamos a URL da thumbnail de qualidade média que a API nos fornece
        thumbnail: ytData?.snippet?.thumbnails?.medium?.url || ytData?.snippet?.thumbnails?.default?.url || '',
      };
    });

    return new Response(JSON.stringify({ data: enrichedData }), {
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