// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseClient'; // Certifique-se que este é o cliente ADMIN ou ajuste para usar service role key aqui

// URL da sua Edge Function que fará a troca de token
const EXCHANGE_TIKTOK_AUTH_CODE_FUNCTION_URL = `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF}.supabase.co/functions/v1/exchange-tiktok-auth-code`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // Contém nicheId, userId e csrf token

  if (!code || !state) {
    // Redirecionar para uma página de erro ou de volta para o nicho com erro
    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${siteUrl}/error?message=TikTok_OAuth_missing_code_or_state`);
  }

  try {
    // Chama a sua Edge Function para realizar a troca de token e salvar no DB
    // IMPORTANTE: A Edge Function precisa das credenciais do TikTok no Supabase Secrets
    // E ela espera 'code' e 'state' no body, assim como a 'redirect_uri'
    const response = await fetch(EXCHANGE_TIKTOK_AUTH_CODE_FUNCTION_URL, {
      method: 'POST', // ou GET, dependendo de como você quer que a Edge Function seja invocada
      headers: {
        'Content-Type': 'application/json',
        // Se a Edge Function precisar de autenticação, você pode adicionar a Service Role Key aqui
        // 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` 
      },
      body: JSON.stringify({ code, state }) // Passa o código e o estado para a Edge Function
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Edge Function error: ${errorData.error || 'Unknown error'}`);
    }

    // A Edge Function, se bem-sucedida, deve retornar uma URL de redirecionamento final.
    // Ou esta API route faz o redirecionamento final com base no sucesso.
    // Por simplicidade, vamos assumir que a Edge Function já fez o redirecionamento ou que vamos redirecionar.
    // Se a Edge Function retornar um JSON de sucesso, você pode redirecionar para o nicho.

    // Se a Edge Function já lida com o redirecionamento final, esta rota não precisa fazer nada além de retornar 200
    // No entanto, como o TikTok espera um redirecionamento, vamos fazer aqui
    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
    const { userId, nicheId } = JSON.parse(atob(state)); // Decodifica o state novamente para obter o nicheId
    return NextResponse.redirect(`${siteUrl}/niche/${nicheId}`);

  } catch (error: any) {
    console.error("Erro no callback OAuth do TikTok (Next.js API Route):", error.message);
    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${siteUrl}/error?message=TikTok_OAuth_callback_failed&details=${encodeURIComponent(error.message)}`);
  }
}

// Você precisará definir NEXT_PUBLIC_SUPABASE_PROJECT_REF em suas variáveis de ambiente do Vercel
// como a referência do seu projeto Supabase (ex: nbqmhhbiolljjnjpktpl)