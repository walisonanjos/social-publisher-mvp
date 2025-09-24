// src/app/niche/[nicheId]/analytics/page.tsx
import { createClient } from "@/lib/supabaseServerClient";
import AnalyticsPageClient from "@/components/AnalyticsPageClient";
import { notFound, redirect } from "next/navigation";

interface PageProps {
  params: {
    nicheId: string;
  };
}

export default async function AnalyticsPage({ params }: PageProps) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: nicheData } = await supabase.from('niches').select('name').eq('id', params.nicheId).single();
  
  if (!nicheData) {
    notFound();
  }

  return <AnalyticsPageClient nicheId={params.nicheId} nicheName={nicheData.name} />;
}