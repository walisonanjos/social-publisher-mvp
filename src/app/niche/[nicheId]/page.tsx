// src/app/niche/[nicheId]/page.tsx
import { createClient } from "@/lib/supabaseServerClient"; // ✅ Mudar para server client
import NichePageClient from "@/components/NichePageClient";
import { notFound, redirect } from "next/navigation"; // ✅ Adicionar redirect
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    nicheId: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const supabase = await createClient(); // ✅ Aguardar criação do client
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { title: 'Acesso negado' };
  }
  
  const { data: nicheData } = await supabase.from('niches').select('name').eq('id', resolvedParams.nicheId).single();
  
  if (!nicheData) {
    return { title: 'Nicho não encontrado' };
  }
  
  return {
    title: `${nicheData.name} - Social Publisher`,
  };
}

export default async function NichePage({ params }: PageProps) {
  const resolvedParams = await params;
  const supabase = await createClient(); // ✅ Aguardar criação do client
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login'); // ✅ Redirecionar em vez de mostrar mensagem
  }
  
  const { data: nicheData } = await supabase.from('niches').select('name').eq('id', resolvedParams.nicheId).single();
  
  if (!nicheData) {
    notFound();
  }

  return <NichePageClient nicheId={resolvedParams.nicheId} nicheName={nicheData.name} />;
}