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

    // 1. Busca vídeos agendados que já passaram da hora
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

    // 2. Itera sobre cada vídeo encontrado
    for (const video of scheduledVideos) {
      try {
        console.log(`Processando vídeo ID: ${video.id} para o nicho ${video.niche_id}`);

        // 3. Busca a conexão social para obter o refresh_token
        const { data: connection, error: connError } = await supabaseAdmin
          .from("social_connections")
          .select("refresh_token")
          .eq("niche_id", video.niche_id)
          .eq("platform", "youtube")
          .single();

        if (connError || !connection?.refresh_token) {
          throw new Error(
            `Refresh token não encontrado para o nicho ${video.niche_id}. Erro: ${connError?.message || 'Token nulo'}`
          );
        }
        
        const refreshToken = connection.refresh_token;

        // PASSO A: Renovar o Access Token usando o Refresh Token
        console.log("Renovando o Access Token...");
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
          throw new Error(`Falha ao renovar o token: ${errorBody.error_description || 'Erro desconhecido'}`);
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        console.log("Access Token renovado com sucesso.");

        // PASSO B: Fazer o upload do vídeo para o YouTube
        console.log(`Iniciando upload para o YouTube do vídeo: ${video.title}`);
        
        const videoMetadata = {
          snippet: {
            title: video.title,
            description: video.description,
            categoryId: "22", 
          },
          status: {
            privacyStatus: "private",
            selfDeclaredMadeForKids: false,
          },
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

        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData,
        });

        const uploadResult = await uploadResponse.json();
        if (!uploadResponse.ok) {
          throw new Error(`Falha no upload para o YouTube: ${uploadResult.error.message}`);
        }

        const youtubeVideoId = uploadResult.id;
        console.log(`Upload para o YouTube concluído com sucesso! ID do vídeo: ${youtubeVideoId}`);

        // PASSO C: Atualiza o status no banco de dados com o ID real
        await supabaseAdmin
          .from("videos")
          .update({
            status: "postado",
            youtube_video_id: youtubeVideoId,
            post_error: null,
          })
          .eq("id", video.id);

        console.log(`Vídeo ID ${video.id} marcado como 'postado' com sucesso (REAL).`);
        
        // PASSO D: Excluir o vídeo do Cloudinary
        if (video.cloudinary_public_id) {
          console.log(`Iniciando exclusão do vídeo no Cloudinary. Public ID: ${video.cloudinary_public_id}`);
          
          const apiKey = Deno.env.get('CLOUDINARY_API_KEY')!;
          const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')!;
          const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')!;
          const timestamp = Math.round(new Date().getTime() / 1000);
          
          const signatureString = `public_id=${video.cloudinary_public_id}&timestamp=${timestamp}${apiSecret}`;
          const signature = await sha1(signatureString); // Usando a nova função

          const deleteFormData = new FormData();
          deleteFormData.append('public_id', video.cloudinary_public_id);
          deleteFormData.append('timestamp', timestamp.toString());
          deleteFormData.append('api_key', apiKey);
          deleteFormData.append('signature', signature);
          
          const deleteResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/destroy`, {
            method: 'POST',
            body: deleteFormData,
          });

          const deleteResult = await deleteResponse.json();
          if (deleteResult.result !== 'ok') {
            console.error("Falha ao deletar do Cloudinary:", deleteResult);
          } else {
            console.log(`Vídeo ${video.cloudinary_public_id} deletado do Cloudinary com sucesso.`);
          }
        }

      } catch (postError) {
        console.error(`Erro ao processar vídeo ID ${video.id}:`, postError.message);
        await supabaseAdmin
          .from("videos")
          .update({ status: "falhou", post_error: postError.message })
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