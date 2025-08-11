// supabase/functions/get-tiktok-analytics/index.ts
// Versão para buscar analytics do TikTok (contagem de seguidores e lista de vídeos)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIKTOK_API_VERSION = "v2";

console.log("Função get-tiktok-analytics INICIALIZADA.");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { nicheId } = await req.json();
    if (!nicheId) throw new Error("O ID do nicho é obrigatório.");
    console.log(`[1/5] Iniciando análise para o nicho: ${nicheId}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("social_connections")
      .select("access_token, refresh_token, provider_user_id, expires_at")
      .eq("niche_id", nicheId)
      .eq("platform", "tiktok")
      .maybeSingle();

    if (connectionError) throw connectionError;
    if (!connection) throw new Error(`[ERRO] Conexão do TikTok não encontrada para o nicho ${nicheId}.`);
    console.log("[2/5] Conexão do TikTok encontrada.");

    let { access_token: accessToken, refresh_token: refreshToken, provider_user_id: openId } = connection;

    // Lógica para renovar o token se estiver expirado ou perto de expirar
    const tokenExpiresAt = new Date(connection.expires_at || 0).getTime();
    const now = Date.now();
    if (tokenExpiresAt - now < 300 * 1000) { // Menos de 5 minutos
      console.log("[3/5] Token de acesso do TikTok expirado ou perto de expirar. Renovando...");
      const refreshResponse = await fetch(
        `https://open.tiktokapis.com/${TIKTOK_API_VERSION}/oauth/token/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_key: Deno.env.get("TIKTOK_CLIENT_ID")!,
            client_secret: Deno.env.get("TIKTOK_CLIENT_SECRET")!,
            grant_type: "refresh_token",
            refresh_token: refreshToken!,
          }).toString(),
        },
      );

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        throw new Error(`[ERRO] Falha ao renovar o token do TikTok: ${errorText}`);
      }
      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;
      refreshToken = refreshData.refresh_token;

      // Atualiza o token no banco de dados
      await supabaseAdmin
        .from("social_connections")
        .update({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: new Date(now + refreshData.expires_in * 1000).toISOString(),
        })
        .eq("niche_id", nicheId)
        .eq("platform", "tiktok");

      console.log("[3/5] Token renovado com sucesso e DB atualizado.");
    }

    // Etapa 4: Busca os dados estatísticos do usuário
    const userStatsUrl = `https://open.tiktokapis.com/${TIKTOK_API_VERSION}/user/info/?fields=follower_count,following_count,likes_count,video_count`;
    const userStatsResponse = await fetch(userStatsUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userStatsResponse.ok) {
      const errorText = await userStatsResponse.text();
      throw new Error(`[ERRO] Falha ao buscar estatísticas do usuário no TikTok: ${errorText}`);
    }
    const userStatsData = await userStatsResponse.json();
    const stats = userStatsData.data?.user || {};
    console.log("[4/5] Estatísticas do usuário obtidas com sucesso.");

    // Etapa 5: Busca a lista de vídeos
    const videoListUrl = `https://open.tiktokapis.com/${TIKTOK_API_VERSION}/video/list/?fields=title,cover_image_url,like_count,comment_count,share_count,view_count`;
    const videoListResponse = await fetch(videoListUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!videoListResponse.ok) {
      const errorText = await videoListResponse.text();
      throw new Error(`[ERRO] Falha ao buscar lista de vídeos no TikTok: ${errorText}`);
    }
    const videoListData = await videoListResponse.json();
    const videos = videoListData.data?.videos || [];
    console.log(`[5/5] Encontrados ${videos.length} vídeos. Retornando resposta.`);

    const analyticsData = {
      userStats: {
        followerCount: stats.follower_count,
        followingCount: stats.following_count,
        likesCount: stats.likes_count,
        videoCount: stats.video_count,
      },
      videos: videos.map((v: any) => ({
        id: v.id,
        title: v.title,
        coverUrl: v.cover_image_url,
        stats: {
          likeCount: v.like_count,
          commentCount: v.comment_count,
          shareCount: v.share_count,
          viewCount: v.view_count,
        },
      })),
    };

    return new Response(JSON.stringify({ data: analyticsData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    console.error("ERRO FATAL NA FUNÇÃO:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});