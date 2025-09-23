// src/app/niche/[nicheId]/page.tsx
import { createClient } from "@/lib/supabaseClient";
import NichePageClient from "@/components/NichePageClient";
import { notFound } from "next/navigation";
import { Metadata } from 'next';

interface PageProps {
  params: {
    nicheId: string;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { title: 'Acesso negado' };
  }
  const { data: nicheData } = await supabase.from('niches').select('name').eq('id', params.nicheId).single();
  
  if (!nicheData) {
    return { title: 'Nicho não encontrado' };
  }
  
  return {
    title: `${nicheData.name} - Social Publisher`,
  };
}

export default async function NichePage({ params }: PageProps) {
  const supabase = createClient();
  
  // A correção está aqui: removemos a checagem de usuário para evitar que a página quebre.
  // A checagem será feita no componente cliente, como era antes.
  const { data: nicheData } = await supabase.from('niches').select('name').eq('id', params.nicheId).single();
  
  if (!nicheData) {
    notFound();
  }

  return <NichePageClient nicheId={params.nicheId} nicheName={nicheData.name} />;
}