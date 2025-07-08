// src/components/AnalyticsPageClient.tsx

"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { User } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";

import MainHeader from "@/components/MainHeader";
import Navbar from "@/components/Navbar";
import Auth from "@/components/Auth";

export default function AnalyticsPageClient({ nicheId }: { nicheId: string }) {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [nicheName, setNicheName] = useState("Análises");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);

      // Pega o usuário logado
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Pega o nome do nicho para o cabeçalho
        const { data: nicheData } = await supabase.from('niches').select('name').eq('id', nicheId).single();
        if (nicheData) setNicheName(nicheData.name);

        // Chama nossa função de backend para buscar as análises
        try {
          const { data, error: functionError } = await supabase.functions.invoke(
            "get-youtube-analytics",
            { body: { nicheId } }
          );

          if (functionError) throw functionError;
          
          setAnalyticsData(data.data || []); // Armazena os dados recebidos

        } catch (e: any) {
          console.error("Erro ao buscar dados de análise:", e);
          setError(e.message);
        }
      }
      setLoading(false);
    };

    fetchInitialData();
  }, [nicheId, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <Loader2 className="h-12 w-12 text-teal-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="bg-gray-900 min-h-screen text-white">
      <MainHeader user={user} pageTitle={`${nicheName} - Análises`} backLink={`/niche/${nicheId}`} />
      <main className="container mx-auto p-4 md:p-8">
        <Navbar nicheId={nicheId} />
        
        <div className="mt-8">
          <h2 className="text-2xl font-bold tracking-tight text-white mb-6">Dashboard de Análises</h2>
          
          {error && (
            <div className="bg-red-500/20 text-red-300 p-4 rounded-md">
              <p className="font-bold mb-2">Ocorreu um erro:</p>
              <p>{error}</p>
            </div>
          )}

          {/* Por enquanto, vamos apenas mostrar os dados brutos para testar */}
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold mb-2">Dados Recebidos do Backend</h3>
            <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-auto">
              {JSON.stringify(analyticsData, null, 2)}
            </pre>
          </div>

        </div>
      </main>
    </div>
  );
}