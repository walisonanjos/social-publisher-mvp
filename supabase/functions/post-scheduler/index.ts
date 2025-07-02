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

    for (const video of scheduledVideos) {
      try {
        console.log(`Processando vídeo ID: ${video.id}`);

        // A lógica de busca de tokens e renovação está correta e continua aqui...
        const { data: connection } = await supabaseAdmin
          .from("social_connections")
          .select("*")
          .eq("niche_id", video.niche_id)
          .eq("platform", "youtube")
          .single();

        if (!connection?.refresh_token) {
          throw new Error(
            `Tokens não encontrados para o nicho ${video.niche_id}`,
          );
        }

        // Simulação do fluxo de postagem
        console.log(`Simulando postagem para o vídeo: ${video.title}`);
        const fakeYouTubeId = `fake_${new Date().getTime()}`;

        // ATUALIZAÇÃO: Marcamos como 'postado' para validar o fluxo
        await supabaseAdmin
          .from("videos")
          .update({
            status: "postado",
            youtube_video_id: fakeYouTubeId,
            post_error: null,
          })
          .eq("id", video.id);

        console.log(
          `Vídeo ID ${video.id} marcado como 'postado' com sucesso (simulação).`,
        );
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
      JSON.stringify({ message: "Processamento simulado concluído." }),
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
