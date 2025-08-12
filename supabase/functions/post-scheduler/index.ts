// supabase/functions/post-scheduler/index.ts
// VERSÃO FINAL COM LOGS APRIMORADOS DO YOUTUBE
// VERSÃO FINAL CORRIGIDA: AGORA COM LÓGICA DE POSTAGEM PARA TIKTOK USANDO UPLOAD DIRETO CORRETAMENTE E RENOVAÇÃO DE TOKEN NO FLUXO PRINCIPAL

// CORREÇÃO: Renomeado createClient para supabaseCreateClient
import { createClient as supabaseCreateClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const GRAPH_API_VERSION = "v20.0";
const TIKTOK_API_VERSION = "v2"; // Versão da API do TikTok
const MAX_RETRIES = 1;
const RETRY_DELAY_MINUTES = 15;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- FUNÇÃO HELPER PARA LOGGING ---
async function logAttempt(
  supabaseAdmin: supabaseCreateClient,
  video_id: number,
  platform: string,
  status: "sucesso" | "falha" | "retentativa",
  details: string
) {
  try {
    const { error } = await supabaseAdmin.from("post_logs").insert({
      video_id,
      platform,
      status,
      details: details.substring(0, 500),
    });
    if (error) {
      console.error("!!! Erro ao salvar log no banco de dados:", error.message);
    }
  } catch (e: any) {
    console.error("!!! Exceção crítica ao salvar log:", e.message);
  }
}

// --- NOVO: Função para renovar o token de acesso do TikTok ---
async function refreshTiktokAccessToken(
  refreshToken: string,
  nicheId: string // Adicionado nicheId para logs ou remoção da conexão
): Promise<{
  accessToken: string;
  newRefreshToken: string | null;
  expiresIn: number;
  refreshExpiresIn: number;
}> {
  const TIKTOK_CLIENT_ID = Deno.env.get("TIKTOK_CLIENT_ID");
  const TIKTOK_CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET");

  if (!TIKTOK_CLIENT_ID || !TIKTOK_CLIENT_SECRET) {
    throw new Error(
      "Variáveis de ambiente TIKTOK_CLIENT_ID ou TIKTOK_CLIENT_SECRET não configuradas para renovação de token."
    );
  }

  const tokenRefreshResponse = await fetch(
    "https://open.tiktokapis.com/v2/oauth/token/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_key: TIKTOK_CLIENT_ID,
        client_secret: TIKTOK_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    }
  );

  if (!tokenRefreshResponse.ok) {
    const errorText = await tokenRefreshResponse.text();
    let errorMessage = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage =
        errorJson.message ||
        errorJson.error_description ||
        JSON.stringify(errorJson);
    } catch (parseError) {} // Não é JSON, use o texto puro

    // Se o refresh token for inválido, é um erro de token que requer reconexão
    const isTokenError =
      errorMessage.toLowerCase().includes("token") ||
      errorMessage.toLowerCase().includes("invalid_grant");
    if (isTokenError) {
      console.log(
        `Token de renovação do TikTok revogado para o nicho ${nicheId}. Removendo conexão.`
      );
      const supabaseAdmin = supabaseCreateClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabaseAdmin
        .from("social_connections")
        .delete()
        .match({ niche_id: nicheId, platform: "tiktok" });
      throw new Error(
        `Token inválido ou expirado. Desconectando conta automaticamente.`
      );
    }
    throw new Error(`Falha ao renovar token do TikTok: ${errorMessage}`);
  }

  const refreshData = await tokenRefreshResponse.json();
  console.log("Token do TikTok renovado com sucesso.");
  return {
    accessToken: refreshData.access_token,
    newRefreshToken: refreshData.refresh_token || refreshToken, // Use o novo refresh token se fornecido
    expiresIn: refreshData.expires_in,
    refreshExpiresIn: refreshData.refresh_expires_in,
  };
}

// Funções Auxiliares para Meta (Instagram/Facebook)
async function startMediaContainer(
  accessToken: string,
  instagramUserId: string,
  videoUrl: string,
  caption: string
): Promise<string> {
  const mediaUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${instagramUserId}/media`;
  const params = new URLSearchParams({
    media_type: "REELS",
    video_url: videoUrl,
    caption: caption,
    access_token: accessToken,
  });
  const response = await fetch(mediaUrl, { method: "POST", body: params });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      `Falha ao iniciar container: ${
        data.error?.message || "Erro desconhecido"
      }`
    );
  console.log(`Container de mídia do Instagram iniciado com ID: ${data.id}`);
  return data.id;
}
async function pollContainerStatus(accessToken: string, creationId: string) {
  const MAX_POLL_RETRIES = 24;
  const POLL_INTERVAL_MS = 5000;
  for (let i = 0; i < MAX_POLL_RETRIES; i++) {
    console.log(
      `Verificando status do container (tentativa ${
        i + 1
      }/${MAX_POLL_RETRIES})...`
    );
    const statusUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${creationId}`;
    const params = new URLSearchParams({
      fields: "status_code",
      access_token: accessToken,
    });
    const response = await fetch(`${statusUrl}?${params.toString()}`);
    const data = await response.json();
    if (!response.ok)
      throw new Error(`Erro ao verificar status: ${data.error?.message}`);
    const status = data.status_code;
    if (status === "FINISHED") {
      console.log("Container processado com sucesso!");
      return;
    }
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(
        `Processamento do container falhou com status: ${status}`
      );
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(
    "Tempo limite excedido ao esperar pelo processamento do vídeo."
  );
}
async function publishMediaContainer(
  accessToken: string,
  instagramUserId: string,
  creationId: string
): Promise<string> {
  const publishUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${instagramUserId}/media_publish`;
  const params = new URLSearchParams({
    creation_id: creationId,
    access_token: accessToken,
  });
  const response = await fetch(publishUrl, { method: "POST", body: params });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      `Falha ao publicar container do Instagram: ${data.error?.message}`
    );
  console.log(
    `Mídia do Instagram publicada com sucesso! ID do post: ${data.id}`
  );
  return data.id;
}
async function sha1(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- FUNÇÃO PRINCIPAL DO AGENDADOR ---
Deno.serve(async (_req) => {
  try {
    const supabaseAdmin = supabaseCreateClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();
    // ATUALIZADO: Incluir tiktok_status na query de seleção de vídeos agendados
    const { data: scheduledVideos, error: fetchError } = await supabaseAdmin
      .from("videos")
      .select("*, niches(social_connections(*))")
      .or(
        "youtube_status.eq.agendado,instagram_status.eq.agendado,facebook_status.eq.agendado,tiktok_status.eq.agendado"
      )
      .lte("scheduled_at", now);

    if (fetchError) throw fetchError;
    if (!scheduledVideos || scheduledVideos.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum vídeo para processar." }),
        { headers: corsHeaders }
      );
    }

    for (const video of scheduledVideos) {
      const errorMessages: string[] = [];
      let successfulPlatforms = 0;
      let updateRequired = false;

      // --- TENTATIVA DE POSTAGEM NO YOUTUBE ---
      if (video.target_youtube && video.youtube_status === "agendado") {
        try {
          console.log(`Processando YouTube para o vídeo ID: ${video.id}`);
          const connection = video.niches?.social_connections.find(
            (c: any) => c.platform === "youtube"
          );
          if (!connection?.refresh_token)
            throw new Error("Refresh token do YouTube não encontrado.");

          const tokenResponse = await fetch(
            "https://oauth2.googleapis.com/token",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                client_id: Deno.env.get("GOOGLE_CLIENT_ID"),
                client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET"),
                refresh_token: connection.refresh_token,
                grant_type: "refresh_token",
              }),
            }
          );

          if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error(`[ERRO DETALHADO YOUTUBE] Falha ao renovar token: ${errorText}`);
            throw new Error(`Falha ao renovar o access token do Google: ${errorText}`);
          }
          const tokenData = await tokenResponse.json();
          const accessToken = tokenData.access_token;
          console.log("Token de acesso renovado com sucesso.");

          const videoMetadata = {
            snippet: {
              title: video.title,
              description: video.description,
              categoryId: "22",
            },
            status: { privacyStatus: "unlisted" },
          };
          const videoFileResponse = await fetch(video.video_url);
          if (!videoFileResponse.ok)
            throw new Error("Não foi possível buscar o vídeo do Cloudinary.");
          const videoBlob = await videoFileResponse.blob();

          const formData = new FormData();
          formData.append(
            "metadata",
            new Blob([JSON.stringify(videoMetadata)], {
              type: "application/json",
            })
          );
          formData.append("video", videoBlob);

          const uploadUrl =
            "https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status";
          const uploadResponse = await fetch(uploadUrl, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
            body: formData,
          });

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error(`[ERRO DETALHADO YOUTUBE] Falha no upload: ${errorText}`);
            throw new Error(`A API de upload do YouTube retornou um erro: ${errorText}`);
          }
          const uploadResult = await uploadResponse.json();
          if (!uploadResult.id) throw new Error("A API de upload do YouTube não retornou um ID de vídeo.");

          const { error: ytUpdateError } = await supabaseAdmin
            .from("videos")
            .update({
              youtube_video_id: uploadResult.id,
              youtube_status: "publicado",
            })
            .eq("id", video.id);
          if (ytUpdateError)
            console.error(
              "Erro ao atualizar status/ID do YouTube:",
              ytUpdateError
            );
          else updateRequired = true;

          successfulPlatforms++;
          await logAttempt(
            supabaseAdmin,
            video.id,
            "youtube",
            "sucesso",
            `Vídeo postado. ID no YouTube: ${uploadResult.id}`
          );
        } catch (e: any) {
          console.error(
            `ERRO no fluxo do YouTube (vídeo ID ${video.id}):`,
            e.message
          );
          errorMessages.push(`Falha no YouTube: ${e.message}`);

          if (video.retry_count < MAX_RETRIES) {
            const newScheduledAt = new Date(
              Date.now() + RETRY_DELAY_MINUTES * 60 * 1000
            ).toISOString();
            const { error: ytRetryUpdateError } = await supabaseAdmin
              .from("videos")
              .update({
                retry_count: video.retry_count + 1,
                scheduled_at: newScheduledAt,
                youtube_status: "agendado",
              })
              .eq("id", video.id);
            if (ytRetryUpdateError)
              console.error(
                "Erro ao atualizar retry YouTube:",
                ytRetryUpdateError
              );
            else updateRequired = true;

            await logAttempt(
              supabaseAdmin,
              video.id,
              "youtube",
              "retentativa",
              e.message
            );
            console.log(
              `Falha no YouTube. Reagendando post ${
                video.id
              } para ${newScheduledAt}. Tentativa ${video.retry_count + 1}.`
            );
          } else {
            const { error: ytFailUpdateError } = await supabaseAdmin
              .from("videos")
              .update({
                youtube_status: "falhou",
              })
              .eq("id", video.id);
            if (ytFailUpdateError)
              console.error(
                "Erro ao atualizar falha YouTube:",
                ytFailUpdateError
              );
            else updateRequired = true;

            await logAttempt(
              supabaseAdmin,
              video.id,
              "youtube",
              "falha",
              e.message
            );
            console.log(
              `Máximo de tentativas atingido para o YouTube no post ${video.id}.`
            );

            const isTokenError =
              e.message.includes("expired or revoked") ||
              e.message.includes("invalid_grant");
            if (isTokenError) {
              console.log(
                `Token do YouTube revogado detectado para o nicho ${video.niche_id}. Removendo conexão.`
              );
              await logAttempt(
                supabaseAdmin,
                video.id,
                "youtube",
                "falha",
                `Token inválido. Desconectando conta automaticamente.`
              );
              await supabaseAdmin
                .from("social_connections")
                .delete()
                .match({ niche_id: video.niche_id, platform: "youtube" });
            }
          }
        }
      }

      // --- TENTATIVA DE POSTAGEM NO INSTAGRAM ---
      if (video.target_instagram && video.instagram_status === "agendado") {
        try {
          console.log(`Processando Instagram para o vídeo ID: ${video.id}`);
          const igConnection = video.niches?.social_connections.find(
            (c: any) => c.platform === "instagram"
          );
          if (!igConnection?.access_token || !igConnection?.provider_user_id)
            throw new Error("Credenciais do Instagram não encontradas.");
          const { access_token, provider_user_id: instagramUserId } =
            igConnection;
          const creationId = await startMediaContainer(
            access_token,
            instagramUserId,
            video.video_url,
            video.description || video.title
          );
          await pollContainerStatus(access_token, creationId);
          const instagramPostId = await publishMediaContainer(
            access_token,
            instagramUserId,
            creationId
          );

          const { error: igUpdateError } = await supabaseAdmin
            .from("videos")
            .update({
              instagram_post_id: instagramPostId,
              instagram_status: "publicado",
            })
            .eq("id", video.id);
          if (igUpdateError)
            console.error(
              "Erro ao atualizar status/ID do Instagram:",
              igUpdateError
            );
          else updateRequired = true;

          successfulPlatforms++;
          await logAttempt(
            supabaseAdmin,
            video.id,
            "instagram",
            "sucesso",
            `Reel postado com sucesso. ID do post: ${instagramPostId}`
          );
        } catch (e: any) {
          console.error(
            `ERRO no fluxo do Instagram (vídeo ID ${video.id}):`,
            e.message
          );
          errorMessages.push(`Falha no Instagram: ${e.message}`);
          if (video.retry_count < MAX_RETRIES) {
            const newScheduledAt = new Date(
              Date.now() + RETRY_DELAY_MINUTES * 60 * 1000
            ).toISOString();
            const { error: igRetryUpdateError } = await supabaseAdmin
              .from("videos")
              .update({
                retry_count: video.retry_count + 1,
                scheduled_at: newScheduledAt,
                instagram_status: "agendado",
              })
              .eq("id", video.id);
            if (igRetryUpdateError)
              console.error(
                "Erro ao atualizar retry Instagram:",
                igRetryUpdateError
              );
            else updateRequired = true;

            await logAttempt(
              supabaseAdmin,
              video.id,
              "instagram",
              "retentativa",
              e.message
            );
            console.log(
              `Falha no Instagram. Reagendando post ${
                video.id
              } para ${newScheduledAt}. Tentativa ${video.retry_count + 1}.`
            );
          } else {
            const { error: igFailUpdateError } = await supabaseAdmin
              .from("videos")
              .update({
                instagram_status: "falhou",
              })
              .eq("id", video.id);
            if (igFailUpdateError)
              console.error(
                "Erro ao atualizar falha Instagram:",
                igFailUpdateError
              );
            else updateRequired = true;

            await logAttempt(
              supabaseAdmin,
              video.id,
              "instagram",
              "falha",
              e.message
            );
            console.log(
              `Máximo de tentativas atingido para o Instagram no post ${video.id}.`
            );

            const isTokenError =
              e.message.toLowerCase().includes("token") ||
              e.message.toLowerCase().includes("session");
            if (isTokenError) {
              console.log(
                `Token do Instagram/Meta revogado detectado para o nicho ${video.niche_id}. Removendo conexão.`
              );
              await logAttempt(
                supabaseAdmin,
                video.id,
                "instagram",
                "falha",
                `Token inválido. Desconectando conta automaticamente.`
              );
              await supabaseAdmin
                .from("social_connections")
                .delete()
                .match({ niche_id: video.niche_id, platform: "instagram" });
            }
          }
        }
      }

      // --- TENTATIVA DE POSTAGEM NO FACEBOOK ---
      if (video.target_facebook && video.facebook_status === "agendado") {
        try {
          console.log(`Processando Facebook para o vídeo ID: ${video.id}`);
          const metaConnection = video.niches?.social_connections.find(
            (c: any) => c.platform === "instagram"
          ); // Usa a conexão 'instagram' para Meta
          if (
            !metaConnection?.access_token ||
            !metaConnection?.provider_user_id
          )
            throw new Error("Credenciais da Meta não encontradas.");
          const {
            access_token: userAccessToken,
            provider_user_id: instagramUserId,
          } = metaConnection;
          const accountsUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id}&access_token=${userAccessToken}`;
          const accountsResponse = await fetch(accountsUrl);
          if (!accountsResponse.ok) {
            const err = await accountsResponse.json();
            throw new Error(err.error.message);
          }
          const accountsData = await accountsResponse.json();
          const linkedPage = accountsData.data.find(
            (page: any) =>
              page.instagram_business_account?.id === instagramUserId
          );
          if (!linkedPage?.id)
            throw new Error(`Nenhuma Página do Facebook encontrada.`);
          const { id: facebookPageId, access_token: facebookPageAccessToken } =
            linkedPage;
          const postUrl = `https://graph-video.facebook.com/${GRAPH_API_VERSION}/${facebookPageId}/videos`;
          const postParams = new URLSearchParams({
            file_url: video.video_url,
            description: `${video.title}\n\n${video.description || ""}`,
            access_token: facebookPageAccessToken,
            video_type: "REEL",
          });
          const postResponse = await fetch(postUrl, {
            method: "POST",
            body: postParams,
          });
          if (!postResponse.ok) {
            const postData = await postResponse.json();
            throw new Error(postData.error?.message);
          }
          const finalPostData = await postResponse.json();

          const { error: fbUpdateError } = await supabaseAdmin
            .from("videos")
            .update({
              facebook_post_id: finalPostData.id,
              facebook_status: "publicado",
            })
            .eq("id", video.id);
          if (fbUpdateError)
            console.error(
              "Erro ao atualizar status/ID do Facebook:",
              fbUpdateError
            );
          else updateRequired = true;

          successfulPlatforms++;
          await logAttempt(
            supabaseAdmin,
            video.id,
            "facebook",
            "sucesso",
            `Reel postado com sucesso. ID do post: ${finalPostData.id}`
          );
        } catch (e: any) {
          console.error(
            `ERRO no fluxo do Facebook (vídeo ID ${video.id}):`,
            e.message
          );
          errorMessages.push(`Falha no Facebook: ${e.message}`);
          if (video.retry_count < MAX_RETRIES) {
            const newScheduledAt = new Date(
              Date.now() + RETRY_DELAY_MINUTES * 60 * 1000
            ).toISOString();
            const { error: fbRetryUpdateError } = await supabaseAdmin
              .from("videos")
              .update({
                retry_count: video.retry_count + 1,
                scheduled_at: newScheduledAt,
                facebook_status: "agendado",
              })
              .eq("id", video.id);
            if (fbRetryUpdateError)
              console.error(
                "Erro ao atualizar retry Facebook:",
                fbRetryUpdateError
              );
            else updateRequired = true;

            await logAttempt(
              supabaseAdmin,
              video.id,
              "facebook",
              "retentativa",
              e.message
            );
            console.log(
              `Falha no Facebook. Reagendando post ${
                video.id
              } para ${newScheduledAt}. Tentativa ${video.retry_count + 1}.`
            );
          } else {
            const { error: fbFailUpdateError } = await supabaseAdmin
              .from("videos")
              .update({
                facebook_status: "falhou",
              })
              .eq("id", video.id);
            if (fbFailUpdateError)
              console.error(
                "Erro ao atualizar falha Facebook:",
                fbFailUpdateError
              );
            else updateRequired = true;

            await logAttempt(
              supabaseAdmin,
              video.id,
              "facebook",
              "falha",
              e.message
            );
            console.log(
              `Máximo de tentativas atingido para o Facebook no post ${video.id}.`
            );

            const isTokenError =
              e.message.toLowerCase().includes("token") ||
              e.message.toLowerCase().includes("session");
            if (isTokenError) {
              console.log(
                `Token do Facebook/Meta revogado detectado para o nicho ${video.niche_id}. Removendo conexão.`
              );
              await logAttempt(
                supabaseAdmin,
                video.id,
                "facebook",
                "falha",
                `Token inválido. Desconectando conta automaticamente.`
              );
              await supabaseAdmin
                .from("social_connections")
                .delete()
                .match({ niche_id: video.niche_id, platform: "instagram" });
            }
          }
        }
      }

      // --- TENTATIVA DE POSTAGEM NO TIKTOK ---
      if (video.target_tiktok && video.tiktok_status === "agendado") {
        try {
          console.log(`Processando TikTok post direto (privado) para o vídeo ID: ${video.id}`);
          const tiktokConnection = video.niches?.social_connections.find(
            (c: any) => c.platform === "tiktok"
          );
          if (!tiktokConnection?.access_token || !tiktokConnection?.provider_user_id)
            throw new Error("Credenciais do TikTok não encontradas.");
          const { access_token: tiktokAccessToken } = tiktokConnection;

          // Etapa 1: Query Creator Info (obrigatório)
          const creatorInfoResponse = await fetch(
            `https://open.tiktokapis.com/${TIKTOK_API_VERSION}/post/publish/creator_info/query/`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${tiktokAccessToken}`,
                "Content-Type": "application/json",
                "User-Agent": "SocialPublisherMVP/1.0",
              },
              body: JSON.stringify({}), // Body vazio para query
            }
          );
          if (!creatorInfoResponse.ok) {
            const errorText = await creatorInfoResponse.text();
            throw new Error(`TikTok creator info query failed: ${errorText}`);
          }
          const creatorData = await creatorInfoResponse.json();
          const privacyOptions = creatorData.data?.privacy_level_options || [];
          if (!privacyOptions.includes("SELF_ONLY")) {
            throw new Error("Conta não suporta posts privados (SELF_ONLY). Verifique configurações.");
          }
          const maxDuration = creatorData.data?.max_video_post_duration_sec || 600; // Default 10min
          console.log(`Creator info: Privacy options: ${privacyOptions}, Max duration: ${maxDuration}s`);

          // Etapa 2: Iniciar post direto
          const cloudinaryUrl = `https://social-publisher-mvp.vercel.app/video/upload/${video.cloudinary_public_id}.mp4`;
          const initPostResponse = await fetch(
            `https://open.tiktokapis.com/${TIKTOK_API_VERSION}/post/publish/video/init/`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${tiktokAccessToken}`,
                "Content-Type": "application/json",
                "User-Agent": "SocialPublisherMVP/1.0",
              },
              body: JSON.stringify({
                post_info: {
                  title: video.title || "Vídeo Automatizado",
                  description: video.description || "",
                  privacy_level: "SELF_ONLY", // Privado no sandbox
                  disable_comment: true, // Exemplo; ajuste conforme UX guidelines
                  disable_duet: true,
                  disable_stitch: true,
                  video_cover_timestamp_ms: 1000, // Exemplo: 1s como cover
                },
                source_info: {
                  source: "PULL_FROM_URL",
                  video_url: cloudinaryUrl, // URL do Cloudinary construída dinamicamente
                },
              }),
            }
          );
          if (!initPostResponse.ok) {
            const errorText = await initPostResponse.text();
            throw new Error(`TikTok post init failed: ${errorText}`); // Pode ser url_ownership_unverified
          }
          const initData = await initPostResponse.json();
          const publishId = initData.data?.publish_id;
          if (!publishId) throw new Error(`TikTok init returned no publish_id: ${JSON.stringify(initData)}`);
          console.log(`TikTok post init successful. Publish ID: ${publishId}`);

          // Etapa 3: Poll status até completo (max ~5-10min)
          const MAX_POLL_RETRIES = 60; // 10s * 60 = 10min
          const POLL_INTERVAL_MS = 10000; // 10s
          let status = "IN_PROGRESS";
          for (let i = 0; i < MAX_POLL_RETRIES; i++) {
            console.log(`Verificando status do TikTok (tentativa ${i + 1}/${MAX_POLL_RETRIES})...`);
            const statusResponse = await fetch(
              `https://open.tiktokapis.com/${TIKTOK_API_VERSION}/post/publish/status/fetch/`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${tiktokAccessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ publish_id: publishId }),
              }
            );
            if (!statusResponse.ok) {
              const errorText = await statusResponse.text();
              throw new Error(`TikTok status fetch failed: ${errorText}`);
            }
            const statusData = await statusResponse.json();
            status = statusData.data?.status || "ERROR";
            if (status === "PUBLISH_COMPLETE") {
              console.log("TikTok post completo!");
              break;
            } else if (status === "FAILED") {
              throw new Error(`TikTok post falhou: ${statusData.data?.fail_reason || "Motivo desconhecido"}`);
            }
            await sleep(POLL_INTERVAL_MS);
          }
          if (status !== "PUBLISH_COMPLETE") throw new Error("Tempo limite no polling de status do TikTok.");

          // Atualização do status
          const { error: tiktokUpdateError } = await supabaseAdmin
            .from("videos")
            .update({
              tiktok_post_id: publishId,
              tiktok_status: "publicado", // Ou "privado" para diferenciar
            })
            .eq("id", video.id);
          if (tiktokUpdateError) console.error("Erro ao atualizar status/ID do TikTok:", tiktokUpdateError);
          else updateRequired = true;

          successfulPlatforms++;
          await logAttempt(
            supabaseAdmin,
            video.id,
            "tiktok",
            "sucesso",
            `Vídeo postado diretamente (privado). ID: ${publishId}`
          );
        } catch (e: any) {
          console.error(`ERRO no fluxo do TikTok (post direto) (vídeo ID ${video.id}):`, e.message);
          errorMessages.push(`Falha no TikTok: ${e.message}`);
          if (video.retry_count < MAX_RETRIES) {
            const newScheduledAt = new Date(
              Date.now() + RETRY_DELAY_MINUTES * 60 * 1000
            ).toISOString();
            const { error: tiktokRetryUpdateError } = await supabaseAdmin
              .from("videos")
              .update({
                retry_count: video.retry_count + 1,
                scheduled_at: newScheduledAt,
                tiktok_status: "agendado",
              })
              .eq("id", video.id);
            if (tiktokRetryUpdateError)
              console.error(
                "Erro ao atualizar retry TikTok:",
                tiktokRetryUpdateError
              );
            else updateRequired = true;

            await logAttempt(
              supabaseAdmin,
              video.id,
              "tiktok",
              "retentativa",
              e.message
            );
            console.log(
              `Falha no TikTok. Reagendando post ${
                video.id
              } para ${newScheduledAt}. Tentativa ${video.retry_count + 1}.`
            );
          } else {
            const { error: tiktokFailUpdateError } = await supabaseAdmin
              .from("videos")
              .update({
                tiktok_status: "falhou",
              })
              .eq("id", video.id);
            if (tiktokFailUpdateError)
              console.error(
                "Erro ao atualizar falha TikTok:",
                tiktokFailUpdateError
              );
            else updateRequired = true;

            await logAttempt(
              supabaseAdmin,
              video.id,
              "tiktok",
              "falha",
              e.message
            );
            console.log(
              `Máximo de tentativas atingido para o TikTok no post ${video.id}.`
            );

            const isTokenError =
              e.message.toLowerCase().includes("token") ||
              e.message.toLowerCase().includes("session") ||
              e.message.toLowerCase().includes("unauthorized");
            if (isTokenError) {
              console.log(
                `Token do TikTok revogado detectado para o nicho ${video.niche_id}. Removendo conexão.`
              );
              await logAttempt(
                supabaseAdmin,
                video.id,
                "tiktok",
                "falha",
                `Token inválido. Desconectando conta automaticamente.`
              );
              await supabaseAdmin
                .from("social_connections")
                .delete()
                .match({ niche_id: video.niche_id, platform: "tiktok" });
            }
          }
        }
      }
      
      // --- ATUALIZAÇÃO FINAL DO POST_ERROR E CLOUDINARY ---
      if (errorMessages.length > 0 || successfulPlatforms > 0) {
        const finalUpdatePayload: { post_error?: string | null } = {
          post_error: errorMessages.join(" | ") || null,
        };
        const { error: finalErrorUpdate } = await supabaseAdmin
          .from("videos")
          .update(finalUpdatePayload)
          .eq("id", video.id);
        if (finalErrorUpdate)
          console.error(
            "Erro ao atualizar post_error do vídeo:",
            finalErrorUpdate
          );
      }

      if (successfulPlatforms > 0 && video.cloudinary_public_id) {
        console.log(
          `Iniciando exclusão do vídeo no Cloudinary: ${video.cloudinary_public_id}`
        );
        const apiKey = Deno.env.get("CLOUDINARY_API_KEY")!;
        const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET")!;
        const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME")!;
        const timestamp = Math.round(new Date().getTime() / 1000);
        const signatureString = `public_id=${video.cloudinary_public_id}&timestamp=${timestamp}${apiSecret}`;
        const signature = await sha1(signatureString);
        const deleteFormData = new FormData();
        deleteFormData.append("public_id", video.cloudinary_public_id);
        deleteFormData.append("timestamp", timestamp.toString());
        deleteFormData.append("api_key", apiKey);
        deleteFormData.append("signature", signature);
        const deleteResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/video/destroy`,
          { method: "POST", body: deleteFormData }
        );
        const deleteResult = await deleteResponse.json();
        if (deleteResult.result !== "ok") {
          console.error("Falha ao deletar do Cloudinary:", deleteResult);
        } else {
          console.log(
            `Vídeo ${video.cloudinary_public_id} deletado do Cloudinary com sucesso.`
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ message: "Processamento concluído." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (e: any) {
    console.error("Erro geral no post-scheduler:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});