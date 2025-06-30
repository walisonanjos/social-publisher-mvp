import NichePageClient from "@/components/NichePageClient";

// Não precisamos mais do 'type Props'

// A MUDANÇA CRÍTICA ESTÁ AQUI: na tipagem dos 'params' e no uso do 'await'
export default async function NichePage({
  params,
}: {
  params: Promise<{ nicheId: string }>;
}) {
  // Agora, esperamos a Promise dos parâmetros ser resolvida para poder usar o nicheId
  const { nicheId } = await params;

  return <NichePageClient nicheId={nicheId} />;
}
