// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server';

const EXCHANGE_TIKTOK_AUTH_CODE_FUNCTION_URL = `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF}.supabase.co/functions/v1/exchange-tiktok-auth-code`;

// Função auxiliar para determinar a URL de redirecionamento final CANÔNICA
const getFinalRedirectUrl = () => {
  // Usa a URL canônica se definida, caso contrário, tenta VERCEL_URL ou fallback
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

  // ATUALIZADO: Usando a função para obter a URL de redirecionamento final
  const finalSiteUrl = getFinalRedirectUrl(); 

  if (!code || !state) {
    return NextResponse.redirect(`${finalSiteUrl}/error?message=TikTok_OAuth_missing_code_or_state`);
  }

  try {
    const { nicheId } = JSON.parse(atob(state));

    const response = await fetch(EXCHANGE_TIKTOK_AUTH_CODE_FUNCTION_URL, {
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

    return NextResponse.redirect(`${finalSiteUrl}/niche/${nicheId}`); // ATUALIZADO: Redireciona para a URL canônica

  } catch (error: unknown) {
    console.error("Erro no callback OAuth do TikTok (Next.js API Route):", error instanceof Error ? error.message : String(error));
    // ATUALIZADO: Em caso de erro, também redireciona para a URL canônica
    return NextResponse.redirect(`${finalSiteUrl}/error?message=TikTok_OAuth_callback_failed&details=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
  }
}