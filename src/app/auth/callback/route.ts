// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server';

const EXCHANGE_TIKTOK_AUTH_CODE_FUNCTION_URL = `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF}.supabase.co/functions/v1/exchange-tiktok-auth-code`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url); // searchParams já é um URLSearchParams
  const code = searchParams.get('code');
  // CORREÇÃO: Removido o ".searchParams" redundante
  const state = searchParams.get('state'); 

  const siteUrl = process.env.SITE_URL || 'http://localhost:3000'; 

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