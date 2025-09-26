// src/app/api/auth/youtube/route.ts

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
        // Em um caso de erro, redireciona para a página inicial
        return NextResponse.redirect(finalSiteUrl + "/?error_message=User_Unauthorized_Missing_Token");
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
        
        // 2. VERIFICA O REDIRECT DA EDGE FUNCTION (Status 303)
        if (response.status === 303) {
            const redirectUrl = response.headers.get('Location');
            if (redirectUrl) {
                // ✅ RETORNA O REDIRECIONAMENTO COM A URL DO GOOGLE
                return NextResponse.redirect(redirectUrl);
            }
        }

        if (!response.ok) {
            const errorText = await response.text(); 
            throw new Error(errorText || 'Edge Function returned an error status.');
        }
        
        // CORREÇÃO FINAL: Se a Edge Function retornar JSON com o authUrl (comportamento antigo/fallback)
        const { authUrl } = await response.json(); 

        // 3. Redireciona o usuário para o Google (caso a Edge Function não tenha retornado 303)
        return NextResponse.redirect(authUrl);

    } catch (error: unknown) {
        console.error("Erro ao gerar URL OAuth do YouTube:", error instanceof Error ? error.message : String(error));
        return NextResponse.redirect(`${finalSiteUrl}/?error_message=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
    }
}