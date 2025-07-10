// supabase/functions/post-scheduler/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Função auxiliar para gerar o hash SHA1 usando a API Web Crypto (método moderno)
async function sha1(str: string): Promise<string> {
    const data = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// Função principal do agendador
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
      // Variáveis para rastrear o sucesso e erros de cada plataforma
      let anyPostSucceeded = false;
      const errorMessages = [];

      // --- ESTRUTURA PARA MÚLTIPLAS PLATAFORMAS ---
      // A lógica original do YouTube foi mantida, mas agora dentro de uma condição.

      // --- TENTATIVA DE POSTAGEM NO YOUTUBE ---
      if (video.target_youtube) {
        try {
          console.log(`Processando YouTube para o vídeo ID: ${video.id}`);
          const { data: connection, error: connError } = await supabaseAdmin
            .from("social_connections")
            .select("refresh_token")
            .eq("niche_id", video.niche_id)
            .eq("platform", "youtube")
            .single();

          if (connError || !connection?.refresh_token) {
            throw new Error(`Refresh token do YouTube não encontrado. Erro: ${connError?.message || 'Token nulo'}`);
          }
          
          const refreshToken = connection.refresh_token;

          console.log("Renovando o Access Token do YouTube...");
          const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              client_id: Deno.env.get("GOOGLE_CLIENT_ID"),
              client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET"),
              refresh_token: refreshToken,
              grant_type: "refresh_token",
            }),
          });

          if (!tokenResponse.ok) {
            const errorBody = await tokenResponse.json();
            throw new Error(`Falha ao renovar o token do YouTube: ${errorBody.error_description || 'Erro desconhecido'}`);
          }

          const tokenData = await tokenResponse.json();
          const accessToken = tokenData.access_token;
          console.log("Access Token do YouTube renovado com sucesso.");

          console.log(`Iniciando upload para o YouTube do vídeo: ${video.title}`);
          const videoMetadata = {
            snippet: { title: video.title, description: video.description, categoryId: "22" },
            status: { privacyStatus: "private", selfDeclaredMadeForKids: false },
          };
          const videoFileResponse = await fetch(video.video_url);
          if (!videoFileResponse.ok) {
            throw new Error("Não foi possível buscar o vídeo do Cloudinary.");
          }
          const videoBlob = await videoFileResponse.blob();
          const formData = new FormData();
          formData.append("metadata", new Blob([JSON.stringify(videoMetadata)], { type: "application/json" }));
          formData.append("video", videoBlob);
          
          const uploadUrl = "https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status";
          const uploadResponse = await fetch(uploadUrl, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: formData });
          const uploadResult = await uploadResponse.json();
          if (!uploadResponse.ok) {
            throw new Error(`Falha no upload para o YouTube: ${uploadResult.error.message}`);
          }

          const youtubeVideoId = uploadResult.id;
          console.log(`Upload para o YouTube concluído com sucesso! ID do vídeo: ${youtubeVideoId}`);

          await supabaseAdmin.from("videos").update({ youtube_video_id: youtubeVideoId }).eq("id", video.id);
          anyPostSucceeded = true;
          
        } catch (e) {
            console.error(`ERRO no fluxo do YouTube (vídeo ID ${video.id}):`, e.message);
            errorMessages.push(`Falha no YouTube: ${e.message}`);
        }
      }

      // --- NOVO BLOCO PARA POSTAGEM NO INSTAGRAM ---
      if (video.target_instagram) {
        try {
            console.log(`Processando Instagram para o vídeo ID: ${video.id}`);
            const { data: igConnection } = await supabaseAdmin.from("social_connections").select("access_token").eq("niche_id", video.niche_id).eq("platform", "instagram").single();
            if (!igConnection?.access_token) {
              throw new Error("Token de acesso do Instagram não encontrado.");
            }

            console.log("Token do Instagram encontrado. Lógica de postagem de Reel (simulada) a seguir.");
            // SIMULAÇÃO DE SUCESSO POR ENQUANTO
            anyPostSucceeded = true;
        } catch(e) {
            console.error(`ERRO no fluxo do Instagram (vídeo ID ${video.id}):`, e.message);
            errorMessages.push(`Falha no Instagram: ${e.message}`);
        }
      }

      // --- LÓGICA FINAL DE ATUALIZAÇÃO E EXCLUSÃO ---
      if (anyPostSucceeded) {
        console.log(`Marcando vídeo ${video.id} como 'postado'.`);
        await supabaseAdmin.from("videos")
            .update({ status: "postado", post_error: errorMessages.join(' | ') || null })
            .eq("id", video.id);
        
        // A sua lógica de exclusão do Cloudinary continua aqui, inalterada
        if (video.cloudinary_public_id) {
          console.log(`Iniciando exclusão do vídeo no Cloudinary: ${video.cloudinary_public_id}`);
          const apiKey = Deno.env.get('CLOUDINARY_API_KEY')!;
          const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')!;
          const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')!;
          const timestamp = Math.round(new Date().getTime() / 1000);
          const signatureString = `public_id=${video.cloudinary_public_id}&timestamp=${timestamp}${apiSecret}`;
          const signature = await sha1(signatureString);
          const deleteFormData = new FormData();
          deleteFormData.append('public_id', video.cloudinary_public_id);
          deleteFormData.append('timestamp', timestamp.toString());
          deleteFormData.append('api_key', apiKey);
          deleteFormData.append('signature', signature);
          const deleteResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/destroy`, { method: 'POST', body: deleteFormData });
          const deleteResult = await deleteResponse.json();
          if (deleteResult.result !== 'ok') {
            console.error("Falha ao deletar do Cloudinary:", deleteResult);
          } else {
            console.log(`Vídeo ${video.cloudinary_public_id} deletado do Cloudinary com sucesso.`);
          }
        }
      } else {
        // Se nenhuma plataforma deu certo, marca como falha geral
        await supabaseAdmin.from("videos")
            .update({ status: "falhou", post_error: errorMessages.join(' | ') })
            .eq("id", video.id);
      }
    }

    return new Response(JSON.stringify({ message: "Processamento concluído." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (e) {
    console.error("Erro geral no post-scheduler:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});