import HistoryPageClient from "@/components/HistoryPageClient";

// A mudança aqui é que não estamos mais criando um 'type alias' chamado 'Props'.
// Estamos definindo o tipo diretamente na assinatura da função.

export default async function HistoryPage({
  params,
}: {
  params: { nicheId: string };
}) {
  const { nicheId } = params;

  return <HistoryPageClient nicheId={nicheId} />;
}
