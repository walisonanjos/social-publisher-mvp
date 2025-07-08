// src/components/AnalyticsPageClient.tsx

"use client";
import { useEffect, useState, useMemo } from "react";
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from "@/lib/supabaseClient";
import { User } from "@supabase/supabase-js";
import { Loader2, BarChart2, Youtube, Eye, ThumbsUp, MessageSquare } from "lucide-react";

import MainHeader from "@/components/MainHeader";
import Navbar from "@/components/Navbar";
import Auth from "@/components/Auth";

// Tipos
interface VideoStatistics {
  viewCount: string;
  likeCount: string;
  commentCount: string;
}
interface AnalyticsVideo {
  youtube_video_id: string;
  title: string;
  thumbnail: string;
  statistics: VideoStatistics;
}

// Componente StatCard
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
    const safeParseInt = (value: string | undefined | null): number => {
      if (value === null || value === undefined || value === 'N/A') return 0;
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? 0 : parsed;
    };
    return {
      totalVideos: analyticsData.length,
      totalViews: analyticsData.reduce((sum, video) => sum + safeParseInt(video.statistics.viewCount), 0),
      totalLikes: analyticsData.reduce((sum, video) => sum + safeParseInt(video.statistics.likeCount), 0),
      totalComments: analyticsData.reduce((sum, video) => sum + safeParseInt(video.statistics.commentCount), 0),
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
            const sortedData = (data.data || []).sort((a: AnalyticsVideo, b: AnalyticsVideo) => 
              parseInt(b.statistics.viewCount || '0', 10) - parseInt(a.statistics.viewCount || '0', 10)
            );
            setAnalyticsData(sortedData);
          } catch (e) {
            if (e instanceof Error) setError(e.message);
            else setError("Ocorreu um erro desconhecido ao buscar análises.");
          }
        }
      }
      setLoading(false);
    };
    fetchInitialData();
  }, [nicheId, supabase]);

  // CORREÇÃO: Blocos de 'loading' e 'auth' agora estão completos
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

  const renderContent = () => {
    // CORREÇÃO: Todos os blocos de renderização de conteúdo estão completos
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
    if (analyticsData.length === 0) {
      return (
         <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 text-center text-gray-400">
           <BarChart2 className="mx-auto h-12 w-12 text-gray-500" />
           <h3 className="mt-4 text-lg font-medium text-white">Nenhum dado para exibir</h3>
           <p className="mt-2 text-sm text-gray-400">
             Ainda não há vídeos postados com sucesso para analisar neste workspace.
           </p>
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
        
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Vídeo</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Visualizações</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Curtidas</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Comentários</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {analyticsData.map((video) => (
                <tr key={video.youtube_video_id} className="hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-20 relative">
                        <Image src={video.thumbnail} alt={`Thumbnail for ${video.title}`} layout="fill" objectFit="cover" className="rounded-md" />
                      </div>
                      <div className="ml-4">
                        <a href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-white hover:text-teal-400 transition-colors">
                          {video.title}
                        </a>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{parseInt(video.statistics.viewCount || '0', 10).toLocaleString('pt-BR')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{parseInt(video.statistics.likeCount || '0', 10).toLocaleString('pt-BR')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{parseInt(video.statistics.commentCount || '0', 10).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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