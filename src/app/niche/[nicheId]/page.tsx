import NichePageClient from "@/components/NichePageClient";

// A tipagem para as props da página
type Props = {
  params: {
    nicheId: string;
  };
};

// CORREÇÃO: Destruturamos o nicheId diretamente na assinatura da função
export default async function NichePage({ params: { nicheId } }: Props) {
  // Agora o nicheId já está disponível diretamente, sem uma linha extra.
  return <NichePageClient nicheId={nicheId} />;
}
