// src/app/niche/[nicheId]/analytics/page.tsx

import AnalyticsPageClient from "@/components/AnalyticsPageClient";

// A correção é marcar a função como 'async' e tipar os params como uma 'Promise'
export default async function AnalyticsPage({ params }: { params: Promise<{ nicheId:string }> }) {
  
  // E então usar 'await' para extrair o valor do nicheId
  const { nicheId } = await params;
  
  return <AnalyticsPageClient nicheId={nicheId} />;
}