// src/app/auth/youtube/route.ts
import { NextResponse } from 'next/server';

// URL da sua Edge Function que lida com a troca de código do Google (YouTube)
const EXCHANGE_YOUTUBE_AUTH_CODE_FUNCTION_URL = `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF}.supabase.co/functions/v1/exchange-auth-code`; 

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
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const finalSiteUrl = getFinalRedirectUrl(); 

  if (!code || !state) {
    return NextResponse.redirect(`${finalSiteUrl}/error?message=YouTube_OAuth_missing_code_or_state`);
  }

  try {
    const { nicheId } = JSON.parse(atob(state));

    // Chama a Edge Function para trocar o código do Google (YouTube) pelo token
    const response = await fetch(EXCHANGE_YOUTUBE_AUTH_CODE_FUNCTION_URL, {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, state })
    });

    if (!response.ok) {
      const errorData = await response.json(); 
      const edgeFunctionErrorMessage = errorData.error 
                                       ? errorData.error 
                                       : JSON.stringify(errorData, null, 2); 

      console.error("Erro retornado pela Edge Function:", edgeFunctionErrorMessage);
      throw new Error(`Edge Function error: ${edgeFunctionErrorMessage}`);
    }

    // A Edge Function do YouTube já retorna um redirect (Status 303) com o Location Header.
    // Precisamos apenas garantir que o Next.js repasse esse redirect.
    const edgeFunctionResponseUrl = response.headers.get('Location');
    if (edgeFunctionResponseUrl) {
      return NextResponse.redirect(edgeFunctionResponseUrl);
    }

    // Fallback: Redireciona manualmente para o nicho
    return NextResponse.redirect(`${finalSiteUrl}/niche/${nicheId}`);

  } catch (error: unknown) {
    console.error("Erro no callback OAuth do YouTube (Next.js API Route):", error instanceof Error ? error.message : String(error));
    // Em caso de erro, redireciona para a página de erro
    return NextResponse.redirect(`${finalSiteUrl}/error?message=YouTube_OAuth_callback_failed&details=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
  }
}