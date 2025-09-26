// src/app/api/auth/youtube/route.ts

import { NextResponse } from 'next/server';

// URL da sua Edge Function que GERA o URL do Google (generate-youtube-auth-url)
const GENERATE_YOUTUBE_AUTH_URL = `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF}.supabase.co/functions/v1/generate-youtube-auth-url`;

// Função auxiliar para determinar a URL de redirecionamento final CANÔNICA
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
    const authHeader = request.headers.get("Authorization"); // Pega o token da requisição Next.js

    const finalSiteUrl = getFinalRedirectUrl(); 

    if (!nicheId) {
        return NextResponse.json({ error: 'Niche ID is missing.' }, { status: 400 });
    }
    if (!authHeader) {
        // Isso não deve acontecer se o MainHeader estiver autenticado, mas é uma verificação de segurança
        return NextResponse.redirect(`${finalSiteUrl}/?error_message=User_Unauthorized`);
    }

    try {
        // 1. Chama a Edge Function para obter o URL de redirecionamento do Google
        const response = await fetch(GENERATE_YOUTUBE_AUTH_URL, {
            method: 'POST', 
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader, // ✅ PASSA O TOKEN DO USUÁRIO PARA A EDGE FUNCTION
            },
            body: JSON.stringify({ nicheId })
        });

        if (!response.ok) {
            const errorData = await response.json(); 
            throw new Error(errorData.error || 'Failed to get Google Auth URL from Edge Function.');
        }

        const { authUrl } = await response.json(); 
        
        // 2. Redireciona o usuário para o Google
        return NextResponse.redirect(authUrl);

    } catch (error: unknown) {
        console.error("Erro ao gerar URL OAuth do YouTube:", error instanceof Error ? error.message : String(error));
        return NextResponse.redirect(`${finalSiteUrl}/?error_message=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
    }
}