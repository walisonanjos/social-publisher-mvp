// src/app/api/auth/youtube/route.ts

import { NextResponse } from 'next/server';

// URL da sua Edge Function que GERA o URL do Google (generate-youtube-auth-url)
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

    if (!nicheId) {
        return NextResponse.json({ error: 'Niche ID is missing.' }, { status: 400 });
    }
    if (!authHeader) {
        return NextResponse.redirect(`${finalSiteUrl}/?error_message=User_Unauthorized`);
    }

    try {
        // CORREÇÃO: Vamos INVOCAR a função Edge via INVOKE (POST), mas o retorno não é um redirect do Next.js
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

        // A Edge Function retorna o authUrl no corpo do JSON
        const { authUrl } = await response.json(); 
        
        // Redireciona o usuário para o Google
        return NextResponse.redirect(authUrl);

    } catch (error: unknown) {
        console.error("Erro ao gerar URL OAuth do YouTube:", error instanceof Error ? error.message : String(error));
        return NextResponse.redirect(`${finalSiteUrl}/?error_message=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
    }
}