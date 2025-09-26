// src/app/api/auth/youtube/route.ts código ok. 
import { NextResponse } from 'next/server';

const GENERATE_YOUTUBE_AUTH_URL = `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF}.supabase.co/functions/v1/generate-youtube-auth-url`;

const getFinalRedirectUrl = () => {
    if (process.env.NEXT_PUBLIC_CANONICAL_SITE_URL) {
        return process.env.NEXT_PUBLIC_CANONICAL_SITE_URL;
    }
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    if (process.env.SITE_URL) { 
        return process.env.SITE_URL;
    }
    return 'http://localhost:3000'; 
};


export async function GET(request: Request) {
    const { searchParams } = new URL(request.url); 
    const nicheId = searchParams.get('nicheId');
    const authHeader = request.headers.get("Authorization"); 

    const finalSiteUrl = getFinalRedirectUrl(); 

    if (!nicheId || !authHeader) {
        return NextResponse.redirect(`${finalSiteUrl}/?error_message=User_Unauthorized`);
    }

    try {
        // 1. Chama a Edge Function para obter o URL de redirecionamento do Google
        const response = await fetch(GENERATE_YOUTUBE_AUTH_URL, {
            method: 'POST', 
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
            },
            body: JSON.stringify({ nicheId })
        });

        if (!response.ok) {
            const errorData = await response.json(); 
            throw new Error(errorData.error || 'Failed to get Google Auth URL from Edge Function.');
        }

        // 2. CORREÇÃO CRÍTICA: LÊ O CORPO E RETORNA O URL DO GOOGLE COMO JSON
        const { authUrl } = await response.json(); 
        
        // Retorna a URL do Google no corpo do JSON (Status 200 OK)
        return NextResponse.json({ authUrl });

    } catch (error: unknown) {
        console.error("Erro ao gerar URL OAuth do YouTube:", error instanceof Error ? error.message : String(error));
        // Se houver qualquer erro na Edge Function, redireciona o usuário para a página de erro
        return NextResponse.redirect(`${finalSiteUrl}/?error_message=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
    }
}