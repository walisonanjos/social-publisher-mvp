// supabase/functions/tiktok-creator-info-test/index.ts
import { createClient as supabaseCreateClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const TIKTOK_API_VERSION = "v2";

Deno.serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const supabaseAdmin = supabaseCreateClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    try {
        // Supondo que você queira testar com uma conexão TikTok existente
        // Você precisará do user_id e niche_id de uma conexão TikTok de teste ativa.
        // Para simplificar o teste, você pode pegar uma conexão manualmente do seu DB para este teste.
        // Ou, se preferir, pode passar o access_token diretamente no corpo da requisição POST para esta função.

        // Exemplo 1: Pegar o access_token do corpo da requisição (mais flexível para teste manual)
        const { access_token_to_test, niche_id_for_log } = await req.json();

        if (!access_token_to_test) {
            throw new Error("access_token_to_test é necessário no corpo da requisição.");
        }

        console.log(`Chamando TikTok Creator Info para nicho: ${niche_id_for_log || 'N/A'}`);

        const creatorInfoResponse = await fetch(
            `https://open.tiktokapis.com/${TIKTOK_API_VERSION}/post/publish/creator_info/query/`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${access_token_to_test}`,
                    "Content-Type": "application/json",
                    "User-Agent": "SocialPublisherMVP/1.0",
                    Connection: "keep-alive",
                },
                body: JSON.stringify({}) // Este endpoint geralmente requer um corpo JSON vazio
            }
        );

        if (!creatorInfoResponse.ok) {
            const errorText = await creatorInfoResponse.text();
            console.error("ERRO TikTok Creator Info:", errorText);
            return new Response(
                JSON.stringify({ error: `Falha ao obter Creator Info: ${errorText}` }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: creatorInfoResponse.status }
            );
        }

        const creatorInfoData = await creatorInfoResponse.json();
        console.log("SUCESSO: Resposta do TikTok Creator Info:", JSON.stringify(creatorInfoData, null, 2));

        // Retorne a resposta completa para poder inspecionar no frontend ou no cliente
        return new Response(
            JSON.stringify({
                message: "Consulta Creator Info concluída. Verifique os logs da Edge Function.",
                data: creatorInfoData
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
        );

    } catch (e: any) {
        console.error("Erro geral na função tiktok-creator-info-test:", e);
        return new Response(JSON.stringify({ error: e.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});