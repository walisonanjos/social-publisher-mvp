// refresh-and-test.ts
import "https://deno.land/x/dotenv/load.ts";

const TIKTOK_CLIENT_ID = Deno.env.get("TIKTOK_CLIENT_ID");
const TIKTOK_CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET");
const TIKTOK_API_VERSION = "v2";

// Sua função para renovar o token de acesso do TikTok
async function refreshTiktokAccessToken(refreshToken: string): Promise<string> {
    if (!TIKTOK_CLIENT_ID || !TIKTOK_CLIENT_SECRET) {
        throw new Error("Variáveis de ambiente TIKTOK_CLIENT_ID ou TIKTOK_CLIENT_SECRET não configuradas.");
    }

    const tokenRefreshResponse = await fetch(
        "https://open.tiktokapis.com/v2/oauth/token/",
        {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
        throw new Error(`Falha ao renovar token do TikTok: ${errorText}`);
    }

    const refreshData = await tokenRefreshResponse.json();
    return refreshData.access_token;
}

// Função de teste para chamar o endpoint query creator info
async function testCreatorInfo(accessToken: string) {
    console.log("Testando endpoint Creator Info com o novo token...");
    const response = await fetch(
        `https://open.tiktokapis.com/${TIKTOK_API_VERSION}/post/publish/creator_info/query/`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                "User-Agent": "SocialPublisherMVP/1.0",
            },
            body: JSON.stringify({})
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error("ERRO ao obter Creator Info:", errorText);
        return;
    }

    const data = await response.json();
    console.log("SUCESSO: Resposta do TikTok Creator Info:", JSON.stringify(data, null, 2));
}

// Lógica principal
try {
    const REFRESH_TOKEN = "rft.t9OCiguWUv2KT2M3C2m9iqjyibmPrGcjo8Wp3eZqMGoWWpHfF9kMABkfHQZG!4551.va";
    
    console.log("Renovando token de acesso...");
    const newAccessToken = await refreshTiktokAccessToken(REFRESH_TOKEN);
    
    console.log("Token de acesso renovado com sucesso.");
    console.log("NOVO ACCESS TOKEN:", newAccessToken);
    
    await testCreatorInfo(newAccessToken);
} catch (e: any) {
    console.error("Erro no fluxo de teste:", e.message);
}