// src/app/niche/[nicheId]/analytics/page.tsx

import AnalyticsPageClient from "@/components/AnalyticsPageClient";

// Esta é uma página de servidor que simplesmente passa os parâmetros 
// para o nosso componente de cliente, que fará todo o trabalho.
export default async function AnalyticsPage({ params }: { params: { nicheId: string } }) {
  const { nicheId } = params;
  return <AnalyticsPageClient nicheId={nicheId} />;
}