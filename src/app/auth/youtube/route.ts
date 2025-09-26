// src/app/api/auth/youtube/route.ts
import { NextResponse } from 'next/server';

// URL da sua Edge Function que GERA o URL do Google
const GENERATE_YOUTUBE_AUTH_URL = `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF}.supabase.co/functions/v1/generate-youtube-auth-url`;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url); 
    const nicheId = searchParams.get('nicheId');
    
    if (!nicheId) {
        return NextResponse.json({ error: 'Niche ID is missing.' }, { status: 400 });
    }

    // A Edge Function precisa do Authorization Header para identificar o usuário.
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
        return NextResponse.json({ error: 'Authorization header is missing.' }, { status: 401 });
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

        if (!response.ok) {
            const errorData = await response.json(); 
            throw new Error(errorData.error || 'Failed to get Google Auth URL from Edge Function.');
        }

        const { authUrl } = await response.json(); 
        
        // 2. Redireciona o usuário para o Google
        return NextResponse.redirect(authUrl);

    } catch (error: unknown) {
        console.error("Erro ao gerar URL OAuth do YouTube:", error instanceof Error ? error.message : String(error));
        return NextResponse.redirect(`/?error_message=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
    }
}