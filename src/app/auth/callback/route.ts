// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server';

const EXCHANGE_TIKTOK_AUTH_CODE_FUNCTION_URL = `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF}.supabase.co/functions/v1/exchange-tiktok-auth-code`;

// Função auxiliar para determinar a URL base do site
const getSiteUrl = () => {
  // Se estiver em um ambiente Vercel (produção ou preview), VERCEL_URL é configurado automaticamente
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Para desenvolvimento local (incluindo Gitpod), SITE_URL precisa ser definida explicitamente
  // Por exemplo, no seu .env.local ou nas configurações de ambiente do Gitpod/terminal
  if (process.env.SITE_URL) {
      return process.env.SITE_URL;
  }
  // Fallback final para desenvolvimento local padrão se SITE_URL não estiver definida
  return 'http://localhost:3000'; 
};


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url); 
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const siteUrl = getSiteUrl(); // Obtém a URL do site dinamicamente

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
      const errorData = await response.json();
      throw new Error(`Edge Function error: ${errorData.error || 'Unknown error'}`);
    }

    return NextResponse.redirect(`${siteUrl}/niche/${nicheId}`);

  } catch (error: unknown) {
    console.error("Erro no callback OAuth do TikTok (Next.js API Route):", error instanceof Error ? error.message : String(error));
    return NextResponse.redirect(`${siteUrl}/error?message=TikTok_OAuth_callback_failed&details=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
  }
}