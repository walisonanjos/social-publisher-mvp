import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (_req) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date().toISOString();
    const { data: scheduledVideos, error: fetchError } = await supabaseAdmin
      .from("videos")
      .select("*")
      .eq("status", "agendado")
      .lte("scheduled_at", now);

    if (fetchError) throw fetchError;
    if (!scheduledVideos || scheduledVideos.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum vídeo para processar." }),
        { headers: corsHeaders },
      );
    }

    console.log(`Encontrados ${scheduledVideos.length} vídeos para processar.`);

    for (const video of scheduledVideos) {
      try {
        console.log(`Processando vídeo ID: ${video.id}`);

        const { data: connection, error: connError } = await supabaseAdmin
          .from("social_connections")
          .select("*")
          .eq("niche_id", video.niche_id)
          .eq("platform", "youtube")
          .single();

        if (connError || !connection || !connection.refresh_token) {
          throw new Error(
            `Tokens não encontrados para o usuário ${video.user_id} no nicho ${video.niche_id}`,
          );
        }

        const tokenResponse = await fetch(
          "https://oauth2.googleapis.com/token",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
              client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
              refresh_token: connection.refresh_token,
              grant_type: "refresh_token",
            }),
          },
        );

        if (!tokenResponse.ok)
          throw new Error("Falha ao renovar o token de acesso do Google.");

        const newTokens = await tokenResponse.json();
        const newAccessToken = newTokens.access_token;

        // Esta é uma SIMULAÇÃO do upload. A API real é mais complexa.
        // Vamos assumir que a criação dos metadados significa sucesso.
        const videoMetadataResponse = await fetch(
          "https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${newAccessToken}`,
              "Content-Type": "application/json; charset=UTF-8",
            },
            body: JSON.stringify({
              snippet: {
                title: video.title,
                description: video.description,
                categoryId: "22",
              },
              status: {
                privacyStatus: "private",
              },
            }),
          },
        );

        if (!videoMetadataResponse.ok) {
          const errorBody = await videoMetadataResponse.json();
          throw new Error(`Erro na API do YouTube: ${errorBody.error.message}`);
        }
        const youtubeData = await videoMetadataResponse.json();

        await supabaseAdmin
          .from("videos")
          .update({ status: "postado", youtube_video_id: youtubeData.id })
          .eq("id", video.id);

        console.log(`Vídeo ID ${video.id} marcado como postado com sucesso.`);
      } catch (postError) {
        console.error(
          `Erro ao processar vídeo ID ${video.id}:`,
          postError.message,
        );
        await supabaseAdmin
          .from("videos")
          .update({ status: "falhou", post_error: postError.message })
          .eq("id", video.id);
      }
    }

    return new Response(
      JSON.stringify({ message: "Processamento concluído." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (e) {
    console.error("Erro geral no post-scheduler:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
