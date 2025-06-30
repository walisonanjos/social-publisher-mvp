import HistoryPageClient from "@/components/HistoryPageClient";

// A tipagem para as props da página
type Props = {
  params: {
    nicheId: string;
  };
};

// CORREÇÃO: Adicionamos a palavra 'async' na função
export default async function HistoryPage({ params }: Props) {
  const { nicheId } = params;

  // Renderiza o componente de cliente, passando o ID do nicho
  return <HistoryPageClient nicheId={nicheId} />;
}
