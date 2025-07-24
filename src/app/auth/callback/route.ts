// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server';

const EXCHANGE_TIKTOK_AUTH_CODE_FUNCTION_URL = `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF}.supabase.co/functions/v1/exchange-tiktok-auth-code`;

const getSiteUrl = () => {
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

  const siteUrl = getSiteUrl(); 

  if (!code || !state) {
    return NextResponse.redirect(`${siteUrl}/error?message=TikTok_OAuth_missing_code_or_state`);
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
      const errorData = await response.json(); // Tenta parsear a resposta da Edge Function como JSON
      // ATUALIZADO: Incluir mais detalhes do erro retornado pela Edge Function
      const edgeFunctionErrorMessage = errorData.error 
                                       ? errorData.error 
                                       : JSON.stringify(errorData, null, 2); // Se não tiver 'error', stringify o JSON completo
      
      console.error("Erro retornado pela Edge Function:", edgeFunctionErrorMessage);
      throw new Error(`Edge Function error: ${edgeFunctionErrorMessage}`);
    }

    return NextResponse.redirect(`${siteUrl}/niche/${nicheId}`);

  } catch (error: unknown) {
    console.error("Erro no callback OAuth do TikTok (Next.js API Route):", error instanceof Error ? error.message : String(error));
    const siteUrl = getSiteUrl(); // Redefinir siteUrl para o caso de erro, garantindo que esteja acessível
    return NextResponse.redirect(`${siteUrl}/error?message=TikTok_OAuth_callback_failed&details=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
  }
}