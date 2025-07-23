// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server';
// REMOVIDO: import { createClient } from '@/lib/supabaseClient'; // Não é mais necessário aqui

const EXCHANGE_TIKTOK_AUTH_CODE_FUNCTION_URL = `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF}.supabase.co/functions/v1/exchange-tiktok-auth-code`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${siteUrl}/error?message=TikTok_OAuth_missing_code_or_state`);
  }

  try {
    // ATUALIZADO: 'userId' removido da desestruturação pois não é usado diretamente nesta rota.
    // Ele ainda é passado para a Edge Function via 'state'.
    const { nicheId } = JSON.parse(atob(state));
    
    const response = await fetch(EXCHANGE_TIKTOK_AUTH_CODE_FUNCTION_URL, {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, state }) // Passa o código e o estado para a Edge Function
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Edge Function error: ${errorData.error || 'Unknown error'}`);
    }

    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${siteUrl}/niche/${nicheId}`);

  } catch (error: unknown) { // ATUALIZADO: 'any' para 'unknown'
    console.error("Erro no callback OAuth do TikTok (Next.js API Route):", error instanceof Error ? error.message : String(error));
    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${siteUrl}/error?message=TikTok_OAuth_callback_failed&details=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
  }
}