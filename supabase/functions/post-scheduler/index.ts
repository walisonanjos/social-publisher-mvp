// supabase/functions/post-scheduler/index.ts
// VERSÃO FINAL - Inclui postagem no YouTube, Instagram e Facebook

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  console.log(`Container de mídia do Instagram iniciado com ID: ${data.id}`);
  return data.id;
}

async function pollContainerStatus(accessToken: string, creationId: string) {
  const MAX_RETRIES = 24;
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
    throw new Error(`Falha ao publicar container do Instagram: ${data.error?.message}`);
  }
  console.log(`Mídia do Instagram publicada com sucesso! ID do post: ${data.id}`);
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
      .select("*, niches(social_connections(*))")
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
          console.log(`Processando YouTube para o vídeo ID: ${video.id}`);
          const connection = video.niches?.social_connections.find((c: any) => c.platform === 'youtube');
          if (!connection?.refresh_token) throw new Error("Refresh token do YouTube não encontrado.");
          
          const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { /* ... */ });
          if (!tokenResponse.ok) { const err = await tokenResponse.json(); throw new Error(err.error_description); }
          const tokenData = await tokenResponse.json();
          const accessToken = tokenData.access_token;

          const videoMetadata = { /* ... */ };
          const videoFileResponse = await fetch(video.video_url);
          const videoBlob = await videoFileResponse.blob();
          const formData = new FormData();
          formData.append("metadata", new Blob([JSON.stringify(videoMetadata)], { type: "application/json" }));
          formData.append("video", videoBlob);
          
          const uploadResponse = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: formData });
          const uploadResult = await uploadResponse.json();
          if (!uploadResponse.ok) throw new Error(uploadResult.error.message);

          await supabaseAdmin.from("videos").update({ youtube_video_id: uploadResult.id }).eq("id", video.id);
          anyPostSucceeded = true;
          console.log(`Postagem no YouTube para o vídeo ${video.id} concluída.`);
        } catch (e) {
          console.error(`ERRO no fluxo do YouTube (vídeo ID ${video.id}):`, e.message);
          errorMessages.push(`Falha no YouTube: ${e.message}`);
        }
      }

      // --- TENTATIVA DE POSTAGEM NO INSTAGRAM ---
      if (video.target_instagram) {
        try {
          console.log(`Processando Instagram para o vídeo ID: ${video.id}`);
          const igConnection = video.niches?.social_connections.find((c: any) => c.platform === 'instagram');
          if (!igConnection?.access_token || !igConnection?.provider_user_id) throw new Error("Credenciais do Instagram não encontradas.");
          
          const { access_token, provider_user_id: instagramUserId } = igConnection;
          const creationId = await startMediaContainer(access_token, instagramUserId, video.video_url, video.description || video.title);
          await pollContainerStatus(access_token, creationId);
          await publishMediaContainer(access_token, instagramUserId, creationId);
          
          anyPostSucceeded = true;
          console.log(`Postagem no Instagram para o vídeo ${video.id} concluída.`);
        } catch(e) {
          console.error(`ERRO no fluxo do Instagram (vídeo ID ${video.id}):`, e.message);
          errorMessages.push(`Falha no Instagram: ${e.message}`);
        }
      }

      // --- NOVO BLOCO PARA POSTAGEM NO FACEBOOK ---
      if (video.target_facebook) {
        try {
            console.log(`Processando Facebook para o vídeo ID: ${video.id}`);
            const metaConnection = video.niches?.social_connections.find((c: any) => c.platform === 'instagram');

            if (!metaConnection?.access_token || !metaConnection?.provider_user_id) {
              throw new Error("Credenciais da Meta não encontradas para buscar a Página do Facebook.");
            }
            
            const { access_token: userAccessToken, provider_user_id: instagramUserId } = metaConnection;

            const accountsUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id}&access_token=${userAccessToken}`;
            const accountsResponse = await fetch(accountsUrl);
            if (!accountsResponse.ok) { const err = await accountsResponse.json(); throw new Error(`Erro ao buscar contas do Facebook: ${err.error.message}`); }
            const accountsData = await accountsResponse.json();

            const linkedPage = accountsData.data.find((page: any) => page.instagram_business_account?.id === instagramUserId);
            if (!linkedPage?.id) throw new Error(`Nenhuma Página do Facebook encontrada vinculada à conta do Instagram com ID: ${instagramUserId}`);

            const facebookPageId = linkedPage.id;
            const facebookPageAccessToken = linkedPage.access_token;
            console.log(`Página do Facebook encontrada: ${linkedPage.name} (ID: ${facebookPageId})`);

            const postUrl = `https://graph-video.facebook.com/${GRAPH_API_VERSION}/${facebookPageId}/videos`;
            const postParams = new URLSearchParams({
                file_url: video.video_url,
                description: `${video.title}\n\n${video.description}`,
                access_token: facebookPageAccessToken,
            });

            const postResponse = await fetch(postUrl, { method: 'POST', body: postParams });
            if (!postResponse.ok) { const postData = await postResponse.json(); throw new Error(`Falha ao postar no Facebook: ${postData.error?.message || 'Erro desconhecido'}`); }

            const finalPostData = await postResponse.json();
            console.log(`Postagem no Facebook para o vídeo ${video.id} concluída com sucesso! ID do post: ${finalPostData.id}`);
            anyPostSucceeded = true;

        } catch(e) {
            console.error(`ERRO no fluxo do Facebook (vídeo ID ${video.id}):`, e.message);
            errorMessages.push(`Falha no Facebook: ${e.message}`);
        }
      }

      // --- LÓGICA FINAL DE ATUALIZAÇÃO E EXCLUSÃO ---
      if (anyPostSucceeded) {
        console.log(`Marcando vídeo ${video.id} como 'postado'.`);
        await supabaseAdmin.from("videos")
          .update({ status: "postado", post_error: errorMessages.join(' | ') || null })
          .eq("id", video.id);
        
        if (video.cloudinary_public_id) {
          // Lógica de exclusão do Cloudinary
          console.log(`Iniciando exclusão do vídeo no Cloudinary: ${video.cloudinary_public_id}`);
          // ... sua lógica de exclusão do Cloudinary ...
        }
      } else if (errorMessages.length > 0) {
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