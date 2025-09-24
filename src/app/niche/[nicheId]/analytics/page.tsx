// src/app/niche/[nicheId]/analytics/page.tsx
import { createClient } from "@/lib/supabaseServerClient";
import AnalyticsPageClient from "@/components/AnalyticsPageClient";
import { notFound, redirect } from "next/navigation";
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    nicheId: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const supabase = await createClient();
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

export default async function AnalyticsPage({ params }: PageProps) {
  const resolvedParams = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }
  
  const { data: nicheData } = await supabase.from('niches').select('name').eq('id', resolvedParams.nicheId).single();
  
  if (!nicheData) {
    notFound();
  }

  return <AnalyticsPageClient nicheId={resolvedParams.nicheId} nicheName={nicheData.name} />;
}