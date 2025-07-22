// supabase/functions/post-scheduler/index.ts
// VERSÃO FINAL COM AUTO-DESCONEXÃO DE TOKENS REVOGADOS

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const GRAPH_API_VERSION = "v20.0";
const MAX_RETRIES = 1;
const RETRY_DELAY_MINUTES = 15;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- NOVA FUNÇÃO HELPER PARA LOGGING ---
async function logAttempt(
  supabaseAdmin: SupabaseClient,
  video_id: number,
  platform: string,
  status: 'sucesso' | 'falha' | 'retentativa',
  details: string
) {
  try {
    const { error } = await supabaseAdmin.from('post_logs').insert({
      video_id,
      platform,
      status,
      details: details.substring(0, 500)
    });
    if (error) {
      console.error("!!! Erro ao salvar log no banco de dados:", error.message);
    }
  } catch (e) {
    console.error("!!! Exceção crítica ao salvar log:", e.message);
  }
}

async function startMediaContainer(accessToken: string, instagramUserId: string, videoUrl: string, caption: string): Promise<string> {
  const mediaUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${instagramUserId}/media`;
  const params = new URLSearchParams({ media_type: "REELS", video_url: videoUrl, caption: caption, access_token: accessToken });
  const response = await fetch(mediaUrl, { method: "POST", body: params });
  const data = await response.json();
  if (!response.ok) throw new Error(`Falha ao iniciar container: ${data.error?.message || "Erro desconhecido"}`);
  console.log(`Container de mídia do Instagram iniciado com ID: ${data.id}`);
  return data.id;
}
async function pollContainerStatus(accessToken: string, creationId: string) {
  const MAX_POLL_RETRIES = 24; const POLL_INTERVAL_MS = 5000;
  for (let i = 0; i < MAX_POLL_RETRIES; i++) {
    console.log(`Verificando status do container (tentativa ${i + 1}/${MAX_POLL_RETRIES})...`);
    const statusUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${creationId}`;
    const params = new URLSearchParams({ fields: "status_code", access_token: accessToken });
    const response = await fetch(`${statusUrl}?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(`Erro ao verificar status: ${data.error?.message}`);
    const status = data.status_code;
    if (status === "FINISHED") { console.log("Container processado com sucesso!"); return; }
    if (status === "ERROR" || status === "EXPIRED") { throw new Error(`Processamento do container falhou com status: ${status}`);}
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error("Tempo limite excedido ao esperar pelo processamento do vídeo.");
}
async function publishMediaContainer(accessToken: string, instagramUserId: string, creationId: string) {
  const publishUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${instagramUserId}/media_publish`;
  const params = new URLSearchParams({ creation_id: creationId, access_token: accessToken });
  const response = await fetch(publishUrl, { method: "POST", body: params });
  const data = await response.json();
  if (!response.ok) throw new Error(`Falha ao publicar container do Instagram: ${data.error?.message}`);
  console.log(`Mídia do Instagram publicada com sucesso! ID do post: ${data.id}`);
}
async function sha1(str: string): Promise<string> {
    const data = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- FUNÇÃO PRINCIPAL DO AGENDADOR ---
Deno.serve(async (_req) => {
  try {
    const supabaseAdmin = createClient( Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! );

    const now = new Date().toISOString();
    const { data: scheduledVideos, error: fetchError } = await supabaseAdmin.from("videos").select("*, niches(social_connections(*))").or('youtube_status.eq.agendado,instagram_status.eq.agendado,facebook_status.eq.agendado').lte("scheduled_at", now);

    if (fetchError) throw fetchError;
    if (!scheduledVideos || scheduledVideos.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum vídeo para processar." }), { headers: corsHeaders });
    }

    for (const video of scheduledVideos){
      const updatePayload: { [key: string]: any } = {};
      const errorMessages: string[] = [];
      let successfulPlatforms = 0;

      // --- TENTATIVA DE POSTAGEM NO YOUTUBE ---
      if (video.target_youtube && video.youtube_status === 'agendado') {
        try {
          console.log(`Processando YouTube para o vídeo ID: ${video.id}`);
          const connection = video.niches?.social_connections.find((c: any) => c.platform === 'youtube');
          if (!connection?.refresh_token) throw new Error("Refresh token do YouTube não encontrado.");
          
          const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              client_id: Deno.env.get("GOOGLE_CLIENT_ID"),
              client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET"),
              refresh_token: connection.refresh_token,
              grant_type: "refresh_token",
            }),
          });
          const tokenText = await tokenResponse.text();
          if (!tokenText) throw new Error("A API de tokens do Google retornou uma resposta vazia.");
          const tokenData = JSON.parse(tokenText);
          if (!tokenResponse.ok) throw new Error(tokenData.error_description || 'Erro desconhecido ao renovar token.');
          const accessToken = tokenData.access_token;
          
          const videoMetadata = {
            snippet: { title: video.title, description: video.description, categoryId: "22" },
            status: { privacyStatus: "unlisted" },
          };
          const videoFileResponse = await fetch(video.video_url);
          if (!videoFileResponse.ok) throw new Error("Não foi possível buscar o vídeo do Cloudinary.");
          const videoBlob = await videoFileResponse.blob();
          
          const formData = new FormData();
          formData.append("metadata", new Blob([JSON.stringify(videoMetadata)], { type: "application/json" }));
          formData.append("video", videoBlob);
          
          const uploadUrl = "https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status";
          const uploadResponse = await fetch(uploadUrl, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: formData });
          
          const uploadText = await uploadResponse.text();
          if (!uploadText) throw new Error("A API de upload do YouTube retornou uma resposta vazia.");
          const uploadResult = JSON.parse(uploadText);
          if (!uploadResponse.ok) throw new Error(uploadResult.error.message);
          
          await supabaseAdmin.from("videos").update({ youtube_video_id: uploadResult.id }).eq("id", video.id);
          updatePayload.youtube_status = 'publicado';
          successfulPlatforms++;
          await logAttempt(supabaseAdmin, video.id, 'youtube', 'sucesso', `Vídeo postado. ID no YouTube: ${uploadResult.id}`);
        } catch (e) {
          console.error(`ERRO no fluxo do YouTube (vídeo ID ${video.id}):`, e.message);
          errorMessages.push(`YouTube: ${e.message}`);
          
          if (video.retry_count < MAX_RETRIES) {
            const newScheduledAt = new Date(Date.now() + RETRY_DELAY_MINUTES * 60 * 1000).toISOString();
            updatePayload.retry_count = video.retry_count + 1;
            updatePayload.scheduled_at = newScheduledAt;
            await logAttempt(supabaseAdmin, video.id, 'youtube', 'retentativa', e.message);
            console.log(`Falha no YouTube. Reagendando post ${video.id} para ${newScheduledAt}. Tentativa ${updatePayload.retry_count}.`);
          } else {
            updatePayload.youtube_status = 'falhou';
            await logAttempt(supabaseAdmin, video.id, 'youtube', 'falha', e.message);
            console.log(`Máximo de tentativas atingido para o YouTube no post ${video.id}.`);

            const isTokenError = e.message.includes('expired or revoked') || e.message.includes('invalid_grant');
            if (isTokenError) {
              console.log(`Token do YouTube revogado detectado para o nicho ${video.niche_id}. Removendo conexão.`);
              await logAttempt(supabaseAdmin, video.id, 'youtube', 'falha', `Token inválido. Desconectando conta automaticamente.`);
              await supabaseAdmin
                .from('social_connections')
                .delete()
                .match({ niche_id: video.niche_id, platform: 'youtube' });
            }
          }
        }
      }

      // --- TENTATIVA DE POSTAGEM NO INSTAGRAM ---
      if (video.target_instagram && video.instagram_status === 'agendado') {
        try {
          console.log(`Processando Instagram para o vídeo ID: ${video.id}`);
          const igConnection = video.niches?.social_connections.find((c: any) => c.platform === 'instagram');
          if (!igConnection?.access_token || !igConnection?.provider_user_id) throw new Error("Credenciais do Instagram não encontradas.");
          const { access_token, provider_user_id: instagramUserId } = igConnection;
          const creationId = await startMediaContainer(access_token, instagramUserId, video.video_url, video.description || video.title);
          await pollContainerStatus(access_token, creationId);
          await publishMediaContainer(access_token, instagramUserId, creationId);
          updatePayload.instagram_status = 'publicado';
          successfulPlatforms++;
          await logAttempt(supabaseAdmin, video.id, 'instagram', 'sucesso', `Reel postado com sucesso.`);
        } catch(e) {
          console.error(`ERRO no fluxo do Instagram (vídeo ID ${video.id}):`, e.message);
          errorMessages.push(`Instagram: ${e.message}`);
          if (video.retry_count < MAX_RETRIES) {
            const newScheduledAt = new Date(Date.now() + RETRY_DELAY_MINUTES * 60 * 1000).toISOString();
            updatePayload.retry_count = video.retry_count + 1;
            updatePayload.scheduled_at = newScheduledAt;
            await logAttempt(supabaseAdmin, video.id, 'instagram', 'retentativa', e.message);
            console.log(`Falha no Instagram. Reagendando post ${video.id} para ${newScheduledAt}. Tentativa ${updatePayload.retry_count}.`);
          } else {
            updatePayload.instagram_status = 'falhou';
            await logAttempt(supabaseAdmin, video.id, 'instagram', 'falha', e.message);
            console.log(`Máximo de tentativas atingido para o Instagram no post ${video.id}.`);
            
            const isTokenError = e.message.toLowerCase().includes('token') || e.message.toLowerCase().includes('session');
            if (isTokenError) {
              console.log(`Token do Instagram/Meta revogado detectado para o nicho ${video.niche_id}. Removendo conexão.`);
              await logAttempt(supabaseAdmin, video.id, 'instagram', 'falha', `Token inválido. Desconectando conta automaticamente.`);
              await supabaseAdmin
                .from('social_connections')
                .delete()
                .match({ niche_id: video.niche_id, platform: 'instagram' });
            }
          }
        }
      }
      
      // --- TENTATIVA DE POSTAGEM NO FACEBOOK ---
      if (video.target_facebook && video.facebook_status === 'agendado') {
        try {
            console.log(`Processando Facebook para o vídeo ID: ${video.id}`);
            const metaConnection = video.niches?.social_connections.find((c: any) => c.platform === 'instagram');
            if (!metaConnection?.access_token || !metaConnection?.provider_user_id) throw new Error("Credenciais da Meta não encontradas.");
            const { access_token: userAccessToken, provider_user_id: instagramUserId } = metaConnection;
            const accountsUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id}&access_token=${userAccessToken}`;
            const accountsResponse = await fetch(accountsUrl);
            if (!accountsResponse.ok) { const err = await accountsResponse.json(); throw new Error(err.error.message); }
            const accountsData = await accountsResponse.json();
            const linkedPage = accountsData.data.find((page: any) => page.instagram_business_account?.id === instagramUserId);
            if (!linkedPage?.id) throw new Error(`Nenhuma Página do Facebook encontrada.`);
            const { id: facebookPageId, access_token: facebookPageAccessToken } = linkedPage;
            const postUrl = `https://graph-video.facebook.com/${GRAPH_API_VERSION}/${facebookPageId}/videos`;
            const postParams = new URLSearchParams({ file_url: video.video_url, description: `${video.title}\n\n${video.description || ''}`, access_token: facebookPageAccessToken, video_type: 'REEL' });
            const postResponse = await fetch(postUrl, { method: 'POST', body: postParams });
            if (!postResponse.ok) { const postData = await postResponse.json(); throw new Error(postData.error?.message); }
            const finalPostData = await postResponse.json();
            updatePayload.facebook_status = 'publicado';
            successfulPlatforms++;
            await logAttempt(supabaseAdmin, video.id, 'facebook', 'sucesso', `Reel postado com sucesso. ID do post: ${finalPostData.id}`);
        } catch(e) {
            console.error(`ERRO no fluxo do Facebook (vídeo ID ${video.id}):`, e.message);
            errorMessages.push(`Facebook: ${e.message}`);
            if (video.retry_count < MAX_RETRIES) {
              const newScheduledAt = new Date(Date.now() + RETRY_DELAY_MINUTES * 60 * 1000).toISOString();
              updatePayload.retry_count = video.retry_count + 1;
              updatePayload.scheduled_at = newScheduledAt;
              await logAttempt(supabaseAdmin, video.id, 'facebook', 'retentativa', e.message);
              console.log(`Falha no Facebook. Reagendando post ${video.id} para ${newScheduledAt}. Tentativa ${updatePayload.retry_count}.`);
            } else {
              updatePayload.facebook_status = 'falhou';
              await logAttempt(supabaseAdmin, video.id, 'facebook', 'falha', e.message);
              console.log(`Máximo de tentativas atingido para o Facebook no post ${video.id}.`);
              
              const isTokenError = e.message.toLowerCase().includes('token') || e.message.toLowerCase().includes('session');
              if (isTokenError) {
                console.log(`Token do Facebook/Meta revogado detectado para o nicho ${video.niche_id}. Removendo conexão.`);
                await logAttempt(supabaseAdmin, video.id, 'facebook', 'falha', `Token inválido. Desconectando conta automaticamente.`);
                await supabaseAdmin
                  .from('social_connections')
                  .delete()
                  .match({ niche_id: video.niche_id, platform: 'instagram' });
              }
            }
        }
      }

      // --- ATUALIZAÇÃO FINAL NO BANCO ---
      if (Object.keys(updatePayload).length > 0) {
        updatePayload.post_error = errorMessages.join(' | ') || null;
        const { error: updateError } = await supabaseAdmin.from("videos").update(updatePayload).eq("id", video.id);
        if (updateError) console.error("Erro ao atualizar status do vídeo:", updateError);
      }
      
      if (successfulPlatforms > 0 && video.cloudinary_public_id) {
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
    }

    return new Response(JSON.stringify({ message: "Processamento concluído." }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (e) {
    console.error("Erro geral no post-scheduler:", e);
    return new Response(JSON.stringify({ error: e.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});