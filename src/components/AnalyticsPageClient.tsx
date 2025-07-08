// src/components/AnalyticsPageClient.tsx

"use client";
import { useEffect, useState, useMemo } from "react";
import Link from 'next/link'; // Necessário para o botão de 'conectar conta'
import { createClient } from "@/lib/supabaseClient";
import { User } from "@supabase/supabase-js";
import { Loader2, BarChart2, Youtube, Eye, ThumbsUp, MessageSquare } from "lucide-react";

import MainHeader from "@/components/MainHeader";
import Navbar from "@/components/Navbar";
import Auth from "@/components/Auth";

// Tipos que já definimos antes
interface VideoStatistics {
  viewCount: string;
  likeCount: string;
  commentCount: string;
}
interface AnalyticsVideo {
  youtube_video_id: string;
  title: string;
  statistics: VideoStatistics;
  // ... outras propriedades que já temos
}

// Componente para um cartão de estatística individual
const StatCard = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | number }) => (
  <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
    <div className="flex items-center">
      <div className="p-3 rounded-full bg-teal-500/10 text-teal-400">
        <Icon className="h-6 w-6" />
      </div>
      <div className="ml-4">
        <p className="text-sm font-medium text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </div>
  </div>
);


export default function AnalyticsPageClient({ nicheId }: { nicheId: string }) {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [nicheName, setNicheName] = useState("Análises");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsVideo[]>([]);
  const [isYouTubeConnected, setIsYouTubeConnected] = useState(false);

  const summaryStats = useMemo(() => {
    if (!analyticsData || analyticsData.length === 0) {
      return { totalVideos: 0, totalViews: 0, totalLikes: 0, totalComments: 0 };
    }
    return {
      totalVideos: analyticsData.length,
      totalViews: analyticsData.reduce((sum, video) => sum + parseInt(video.statistics.viewCount || '0', 10), 0),
      totalLikes: analyticsData.reduce((sum, video) => sum + parseInt(video.statistics.likeCount || '0', 10), 0),
      totalComments: analyticsData.reduce((sum, video) => sum + parseInt(video.statistics.commentCount || '0', 10), 0),
    };
  }, [analyticsData]);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data: nicheData } = await supabase.from('niches').select('name').eq('id', nicheId).single();
        if (nicheData) setNicheName(nicheData.name);
        const { count } = await supabase.from('social_connections').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('niche_id', nicheId).eq('platform', 'youtube');
        const connected = !!count && count > 0;
        setIsYouTubeConnected(connected);
        if (connected) {
          try {
            const { data, error: functionError } = await supabase.functions.invoke("get-youtube-analytics",{ body: { nicheId } });
            if (functionError) throw functionError;
            setAnalyticsData(data.data || []);
          } catch (e) {
            console.error("Erro ao buscar dados de análise:", e);
            if (e instanceof Error) setError(e.message);
            else setError("Ocorreu um erro desconhecido ao buscar análises.");
          }
        }
      }
      setLoading(false);
    };
    fetchInitialData();
  }, [nicheId, supabase]);

  if (loading) { return <div className="flex items-center justify-center min-h-screen bg-gray-900"><Loader2 className="h-12 w-12 text-teal-400 animate-spin" /></div>; }
  if (!user) { return <Auth />; }

  const renderContent = () => {
    // CORREÇÃO: Bloco de código para 'não conectado' agora está completo
    if (!isYouTubeConnected) {
      return (
        <div className="text-center bg-gray-800 p-8 rounded-lg border border-gray-700">
          <Youtube className="mx-auto h-12 w-12 text-gray-500" />
          <h3 className="mt-4 text-lg font-medium text-white">YouTube não conectado</h3>
          <p className="mt-2 text-sm text-gray-400">
            Para ver as análises de performance, primeiro conecte uma conta do YouTube a este workspace.
          </p>
          <Link href={`/niche/${nicheId}`}>
            <button className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700">
              Ir para a página de conexão
            </button>
          </Link>
        </div>
      );
    }
    if (error) {
      return (
        <div className="bg-red-500/20 text-red-300 p-4 rounded-md">
          <p className="font-bold mb-2">Ocorreu um erro:</p>
          <p>{error}</p>
        </div>
      );
    }
    
    return (
      <>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard icon={BarChart2} label="Vídeos Analisados" value={summaryStats.totalVideos} />
          <StatCard icon={Eye} label="Total de Visualizações" value={summaryStats.totalViews.toLocaleString('pt-BR')} />
          <StatCard icon={ThumbsUp} label="Total de Curtidas" value={summaryStats.totalLikes.toLocaleString('pt-BR')} />
          <StatCard icon={MessageSquare} label="Total de Comentários" value={summaryStats.totalComments.toLocaleString('pt-BR')} />
        </div>
        
        {/* Futuramente, aqui entrarão os gráficos. */}
        {analyticsData.length === 0 && (
           <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 text-center text-gray-400">
             <BarChart2 className="mx-auto h-12 w-12 text-gray-500" />
             <h3 className="mt-4 text-lg font-medium text-white">Nenhum dado para exibir</h3>
             <p className="mt-2 text-sm text-gray-400">
               Ainda não há vídeos postados com sucesso para analisar neste workspace.
             </p>
           </div>
        )}
      </>
    );
  };

  return (
    <div className="bg-gray-900 min-h-screen text-white">
      <MainHeader user={user} pageTitle={`${nicheName} - Análises`} backLink={`/niche/${nicheId}`} />
      <main className="container mx-auto p-4 md:p-8">
        <Navbar nicheId={nicheId} />
        <div className="mt-8">
          <h2 className="text-2xl font-bold tracking-tight text-white mb-6">Dashboard de Análises</h2>
          {renderContent()}
        </div>
      </main>
    </div>
  );
}