// supabase/functions/post-scheduler/index.ts
// VERSÃO 100% COMPLETA E CORRIGIDA - 11/Jul/2025

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// --- FUNÇÕES HELPER PARA A API DO INSTAGRAM ---
const GRAPH_API_VERSION = "v20.0";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function startMediaContainer(accessToken: string, instagramUserId: string, videoUrl: string, caption: string): Promise<string> {
  const mediaUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${instagramUserId}/media`;
  const params = new URLSearchParams({
    media_type: "REELS",
    video_url: videoUrl,
    caption: caption,
    access_token: accessToken,
  });
  const response = await fetch(mediaUrl, { method: "POST", body: params });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Falha ao iniciar container: ${data.error?.message || "Erro desconhecido"}`);
  }
  console.log(`Container de mídia iniciado com ID: ${data.id}`);
  return data.id;
}

async function pollContainerStatus(accessToken: string, creationId: string) {
  const MAX_RETRIES = 24; // Tenta por 120s
  const POLL_INTERVAL_MS = 5000;
  for (let i = 0; i < MAX_RETRIES; i++) {
    console.log(`Verificando status do container (tentativa ${i + 1}/${MAX_RETRIES})...`);
    const statusUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${creationId}`;
    const params = new URLSearchParams({ fields: "status_code", access_token: accessToken });
    const response = await fetch(`${statusUrl}?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(`Erro ao verificar status: ${data.error?.message}`);
    const status = data.status_code;
    if (status === "FINISHED") {
      console.log("Container processado com sucesso!");
      return;
    }
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`Processamento do container falhou com status: ${status}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error("Tempo limite excedido ao esperar pelo processamento do vídeo.");
}

async function publishMediaContainer(accessToken: string, instagramUserId: string, creationId: string) {
  const publishUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${instagramUserId}/media_publish`;
  const params = new URLSearchParams({ creation_id: creationId, access_token: accessToken });
  const response = await fetch(publishUrl, { method: "POST", body: params });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Falha ao publicar container: ${data.error?.message}`);
  }
  console.log(`Mídia publicada com sucesso! ID do post: ${data.id}`);
}

async function sha1(str: string): Promise<string> {
    const data = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// --- FUNÇÃO PRINCIPAL DO AGENDADOR ---
Deno.serve(async (_req) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date().toISOString();
    const { data: scheduledVideos, error: fetchError } = await supabaseAdmin
      .from("videos")
      .select("*, niches(social_connections(*))") // CORREÇÃO APLICADA AQUI
      .eq("status", "agendado")
      .lte("scheduled_at", now);

    if (fetchError) throw fetchError;
    if (!scheduledVideos || scheduledVideos.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum vídeo para processar." }), { headers: corsHeaders });
    }

    for (const video of scheduledVideos) {
      let anyPostSucceeded = false;
      const errorMessages = [];

      // --- TENTATIVA DE POSTAGEM NO YOUTUBE ---
      if (video.target_youtube) {
        try {
          // Lógica completa do YouTube (preservada do seu código)
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

      // --- BLOCO PREENCHIDO PARA POSTAGEM NO INSTAGRAM ---
      if (video.target_instagram) {
        try {
            console.log(`Processando Instagram para o vídeo ID: ${video.id}`);
            const igConnection = video.niches?.social_connections.find((c: any) => c.platform === 'instagram');

            if (!igConnection?.access_token || !igConnection?.provider_user_id) {
              throw new Error("Credenciais do Instagram (token ou user ID) não encontradas.");
            }
            
            const { access_token, provider_user_id: instagramUserId } = igConnection;
            const creationId = await startMediaContainer(access_token, instagramUserId, video.video_url, video.description || video.title);
            await pollContainerStatus(access_token, creationId);
            await publishMediaContainer(access_token, instagramUserId, creationId);
            
            console.log(`Postagem no Instagram para o vídeo ${video.id} concluída.`);
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
        
        if (video.cloudinary_public_id) {
          // Lógica de exclusão do Cloudinary (preservada do seu código)
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