// supabase/functions/get-meta-analytics/index.ts

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH_API_VERSION = "v20.0";

// Função auxiliar para buscar insights de um único post
async function getPostInsights(postId: string, accessToken: string, platform: 'instagram' | 'facebook') {
  let insightsUrl = '';

  if (platform === 'instagram') {
    // Para o Instagram, as métricas são mais diretas
    const metrics = 'likes,comments,reach,video_views';
    insightsUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${postId}/insights?metric=${metrics}&access_token=${accessToken}`;
  } else { // platform === 'facebook'
    // Para o Facebook, as métricas têm nomes diferentes
    const metrics = 'post_reactions_like_total,post_comments,post_impressions,total_video_views';
    insightsUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${postId}/insights?metric=${metrics}&access_token=${accessToken}`;
  }
  
  const response = await fetch(insightsUrl);
  if (!response.ok) {
    const errorData = await response.json();
    // Se a API retornar um erro, registramos mas não quebramos a execução para os outros vídeos
    console.error(`Erro ao buscar insights para o post ${postId} (${platform}):`, errorData.error.message);
    return null; // Retorna nulo para indicar falha
  }
  
  const data = await response.json();
  return data.data; // A API retorna os dados dentro de um objeto 'data'
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { nicheId } = await req.json();
    if (!nicheId) throw new Error("O ID do nicho é obrigatório.");

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Busca a conexão da Meta para obter o token de acesso
    const { data: connection } = await supabaseAdmin
      .from("social_connections")
      .select("access_token")
      .eq("niche_id", nicheId)
      .eq("platform", "instagram") // A conexão da Meta é a mesma para IG e FB
      .single();

    if (!connection?.access_token) {
      throw new Error(`Token de acesso da Meta não encontrado para o nicho ${nicheId}.`);
    }
    const accessToken = connection.access_token;

    // Busca todos os vídeos do nicho que foram postados com sucesso no IG ou FB
    const { data: postedVideos, error: videosError } = await supabaseAdmin
      .from("videos")
      .select("id, title, scheduled_at, instagram_post_id, facebook_post_id")
      .eq("niche_id", nicheId)
      .or('instagram_status.eq.publicado,facebook_status.eq.publicado');
    
    if (videosError) throw videosError;

    if (!postedVideos || postedVideos.length === 0) {
      return new Response(JSON.stringify({ data: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Usamos Promise.all para buscar as estatísticas de todos os vídeos em paralelo
    const enrichedDataPromises = postedVideos.map(async (video) => {
      let igInsights = null;
      let fbInsights = null;

      if (video.instagram_post_id) {
        igInsights = await getPostInsights(video.instagram_post_id, accessToken, 'instagram');
      }
      if (video.facebook_post_id) {
        fbInsights = await getPostInsights(video.facebook_post_id, accessToken, 'facebook');
      }
      
      // Combina os dados do vídeo com as estatísticas encontradas
      return {
        ...video,
        instagram_insights: igInsights,
        facebook_insights: fbInsights,
      };
    });

    const enrichedData = await Promise.all(enrichedDataPromises);

    return new Response(JSON.stringify({ data: enrichedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (e) {
    console.error("Erro na função get-meta-analytics:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});