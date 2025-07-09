// src/components/AnalyticsPageClient.tsx

"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from "@/lib/supabaseClient";
import { User } from "@supabase/supabase-js";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader2, BarChart2 as ChartIcon, Youtube, Eye, ThumbsUp, MessageSquare } from "lucide-react";

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

// Função auxiliar para parse seguro
const safeParseInt = (value: string | undefined | null): number => {
  if (value === null || value === undefined || value === 'N/A') return 0;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? 0 : parsed;
};

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
      totalViews: analyticsData.reduce((sum, video) => sum + safeParseInt(video.statistics.viewCount), 0),
      totalLikes: analyticsData.reduce((sum, video) => sum + safeParseInt(video.statistics.likeCount), 0),
      totalComments: analyticsData.reduce((sum, video) => sum + safeParseInt(video.statistics.commentCount), 0),
    };
  }, [analyticsData]);

  const chartData = useMemo(() => {
    return analyticsData.map(video => ({
      name: video.title.length > 20 ? `${video.title.substring(0, 20)}...` : video.title,
      Visualizações: safeParseInt(video.statistics.viewCount),
      Curtidas: safeParseInt(video.statistics.likeCount),
    }));
  }, [analyticsData]);
  
  const fetchPageData = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
        setLoading(false);
        return;
    };
    
    setError(null);

    const { data: nicheData } = await supabase.from('niches').select('name').eq('id', nicheId).single();
    if (nicheData) setNicheName(nicheData.name);
    
    const { count } = await supabase.from('social_connections').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).eq('niche_id', nicheId).eq('platform', 'youtube');
    const connected = !!count && count > 0;
    setIsYouTubeConnected(connected);

    if (connected) {
      try {
        const { data, error: functionError } = await supabase.functions.invoke("get-youtube-analytics",{ body: { nicheId } });
        if (functionError) throw functionError;
        const sortedData = (data.data || []).sort((a: AnalyticsVideo, b: AnalyticsVideo) => 
          safeParseInt(b.statistics.viewCount) - safeParseInt(a.statistics.viewCount)
        );
        setAnalyticsData(sortedData);
      } catch (e) {
        if (e instanceof Error) setError(e.message);
        else setError("Ocorreu um erro desconhecido ao buscar análises.");
      }
    }
    setLoading(false);
  }, [nicheId, supabase]);

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
      if (currentUser) {
        fetchPageData();
      } else {
        setLoading(false);
      }
    };
    initialize();
  }, [fetchPageData, supabase.auth]);
  
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`analytics-realtime-${nicheId}`)
      .on(
        'postgres_changes',
        { 
          event: '*',
          schema: 'public',
          table: 'videos',
          filter: `niche_id=eq.${nicheId}`
        },
        (payload) => {
          console.log('Mudança na tabela de vídeos recebida pela Dashboard!', payload);
          fetchPageData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, nicheId, supabase, fetchPageData]);


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
        <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard icon={ChartIcon} label="Vídeos Analisados" value={summaryStats.totalVideos} />
          <StatCard icon={Eye} label="Total de Visualizações" value={summaryStats.totalViews.toLocaleString('pt-BR')} />
          <StatCard icon={ThumbsUp} label="Total de Curtidas" value={summaryStats.totalLikes.toLocaleString('pt-BR')} />
          <StatCard icon={MessageSquare} label="Total de Comentários" value={summaryStats.totalComments.toLocaleString('pt-BR')} />
        </div>
        
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Desempenho por Vídeo</h3>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                    <Legend wrapperStyle={{ fontSize: '14px' }} />
                    <Bar dataKey="Visualizações" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Curtidas" fill="#818cf8" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
        
        {analyticsData.length > 0 ? (
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
                          {/* CORREÇÃO APLICADA AQUI */}
                          <Image 
                            src={video.thumbnail} 
                            alt={`Thumbnail for ${video.title}`} 
                            fill 
                            style={{ objectFit: 'cover' }} 
                            className="rounded-md" 
                          />
                        </div>
                        <div className="ml-4 max-w-xs truncate">
                           {/* CORREÇÃO APLICADA AQUI */}
                          <a 
                            href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-sm font-medium text-white hover:text-teal-400 transition-colors"
                          >
                            {video.title}
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{safeParseInt(video.statistics.viewCount).toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{safeParseInt(video.statistics.likeCount).toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{safeParseInt(video.statistics.commentCount).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 text-center text-gray-400">
            <ChartIcon className="mx-auto h-12 w-12 text-gray-500" />
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