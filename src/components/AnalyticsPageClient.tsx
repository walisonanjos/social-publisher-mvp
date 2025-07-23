"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import Link from 'next/link';
import { createClient } from "@/lib/supabaseClient";
import { User } from "@supabase/supabase-js";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader2, BarChart2 as ChartIcon, Youtube, Eye, ThumbsUp, MessageSquare, CameraOff, Instagram } from "lucide-react"; // Adicionado Instagram

import MainHeader from "@/components/MainHeader";
import Navbar from "@/components/Navbar";
import Auth from "@/components/Auth";

// --- NOVOS TIPOS PARA OS DADOS DA META ---
interface MetaInsightValue { value: number; }
interface MetaInsight { name: string; period: string; values: MetaInsightValue[]; }
interface MetaAnalyticsVideo { id: number; title: string; scheduled_at: string; instagram_post_id: string | null; facebook_post_id: string | null; instagram_insights: MetaInsight[] | null; facebook_insights: MetaInsight[] | null; }
// Tipos antigos do YouTube (renomeado)
interface VideoStatistics { viewCount: string; likeCount: string; commentCount: string; }
interface YouTubeAnalyticsVideo { youtube_video_id: string; title: string; thumbnail: string; scheduled_at: string; statistics: VideoStatistics; }

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

// --- NOVA FUNÇÃO AUXILIAR PARA EXTRAIR DADOS DA META ---
const getMetaInsightValue = (insights: MetaInsight[] | null, metricName: string): number => {
  if (!insights) return 0;
  const metric = insights.find(insight => insight.name === metricName);
  return metric?.values?.[0]?.value ?? 0;
};

export default function AnalyticsPageClient({ nicheId }: { nicheId: string }) {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [nicheName, setNicheName] = useState("Análises");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [youtubeData, setYoutubeData] = useState<YouTubeAnalyticsVideo[]>([]);
  const [metaData, setMetaData] = useState<MetaAnalyticsVideo[]>([]);
  const [isYouTubeConnected, setIsYouTubeConnected] = useState(false);
  const [isInstagramConnected, setIsInstagramConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'youtube' | 'meta'>('youtube');

  const fetchPageData = useCallback(async (userId: string) => {
    setError(null);
    setLoading(true);

    const { data: nicheData } = await supabase.from('niches').select('name').eq('id', nicheId).single();
    if (nicheData) setNicheName(nicheData.name);

    const { data: connections } = await supabase.from('social_connections').select('platform').eq('user_id', userId).eq('niche_id', nicheId);
    
    const ytConnected = connections?.some(c => c.platform === 'youtube') || false;
    const igConnected = connections?.some(c => c.platform === 'instagram') || false;
    setIsYouTubeConnected(ytConnected);
    setIsInstagramConnected(igConnected);

    if (ytConnected && activeTab !== 'meta') { // Mantém a aba atual se já for YouTube e YouTube estiver conectado
      setActiveTab('youtube');
    } else if (igConnected) { // Se YouTube não estiver conectado ou a aba atual for Meta, e Instagram estiver conectado, muda para Meta
      setActiveTab('meta');
    } else { // Se nenhum estiver conectado
      setActiveTab('youtube'); // Default para YouTube, mas o conteúdo será "não conectado"
    }

    try {
      if (ytConnected) {
        const { data, error: functionError } = await supabase.functions.invoke("get-youtube-analytics", { body: { nicheId } });
        if (functionError) throw new Error(`YouTube Analytics: ${functionError.message}`);
        setYoutubeData(data?.data || []);
      } else {
        setYoutubeData([]); // Limpar dados se não estiver conectado
      }

      if (igConnected) {
        const { data, error: functionError } = await supabase.functions.invoke("get-meta-analytics", { body: { nicheId } });
        if (functionError) throw new Error(`Meta Analytics: ${functionError.message}`);
        setMetaData(data?.data || []);
      } else {
        setMetaData([]); // Limpar dados se não estiver conectado
      }
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError("Ocorreu um erro desconhecido ao buscar análises.");
    } finally {
      setLoading(false);
    }
  }, [nicheId, supabase, activeTab]); // 'activeTab' adicionado às dependências

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
      if (currentUser) {
        fetchPageData(currentUser.id); // Passa o userId para fetchPageData
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
          table: 'videos', // Monitora a tabela de vídeos
          filter: `niche_id=eq.${nicheId}`
        },
        (payload) => {
          console.log('Mudança na tabela de vídeos recebida pela Dashboard!', payload);
          fetchPageData(user.id); // Recarrega os dados ao receber mudança
        }
      )
      .subscribe();

    const socialConnectionsChannel = supabase
      .channel(`social-connections-realtime-${nicheId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_connections',
          filter: `niche_id=eq.${nicheId}`
        },
        (payload) => {
          console.log('Mudança na tabela de conexões sociais recebida pela Dashboard!', payload);
          fetchPageData(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(socialConnectionsChannel);
    };
  }, [user, nicheId, supabase, fetchPageData]);

  // Lógica de renderização específica para YouTube
  const renderYouTubeContent = () => {
    const summaryStats = useMemo(() => {
      if (!youtubeData || youtubeData.length === 0) {
        return { totalVideos: 0, totalViews: 0, totalLikes: 0, totalComments: 0 };
      }
      return {
        totalVideos: youtubeData.length,
        totalViews: youtubeData.reduce((sum, video) => sum + safeParseInt(video.statistics.viewCount), 0),
        totalLikes: youtubeData.reduce((sum, video) => sum + safeParseInt(video.statistics.likeCount), 0),
        totalComments: youtubeData.reduce((sum, video) => sum + safeParseInt(video.statistics.commentCount), 0),
      };
    }, [youtubeData]);

    const chartData = useMemo(() => {
      return youtubeData.map(video => ({
        name: video.title.length > 20 ? `${video.title.substring(0, 20)}...` : video.title,
        Visualizações: safeParseInt(video.statistics.viewCount),
        Curtidas: safeParseInt(video.statistics.likeCount),
      }));
    }, [youtubeData]);

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
        
        {youtubeData.length > 0 ? (
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-800/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Vídeo</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Data da Postagem</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Visualizações</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Curtidas</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Comentários</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {youtubeData.map((video) => (
                  <tr key={video.youtube_video_id} className="hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-20 bg-gray-700 rounded-md flex items-center justify-center">
                          {video.thumbnail ? (
                            <img src={video.thumbnail} alt={`Thumbnail for ${video.title}`} className="h-full w-full rounded-md object-cover" />
                          ) : (
                            <CameraOff className="h-5 w-5 text-gray-500" />
                          )}
                        </div>
                        <div className="ml-4 max-w-xs truncate">
                          <a href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-white hover:text-teal-400 transition-colors">
                            {video.title}
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {new Date(video.scheduled_at).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
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

  // Lógica de renderização específica para Meta (Instagram/Facebook)
  const renderMetaContent = () => {
    const summaryStats = useMemo(() => {
      if (!metaData || metaData.length === 0) {
        return { totalVideos: 0, totalImpressions: 0, totalReach: 0, totalLikes: 0, totalComments: 0 };
      }
      return {
        totalVideos: metaData.length,
        totalImpressions: metaData.reduce((sum, video) => sum + getMetaInsightValue(video.instagram_insights, 'impressions') + getMetaInsightValue(video.facebook_insights, 'impressions'), 0),
        totalReach: metaData.reduce((sum, video) => sum + getMetaInsightValue(video.instagram_insights, 'reach') + getMetaInsightValue(video.facebook_insights, 'reach'), 0),
        totalLikes: metaData.reduce((sum, video) => sum + getMetaInsightValue(video.instagram_insights, 'likes') + getMetaInsightValue(video.facebook_insights, 'likes'), 0),
        totalComments: metaData.reduce((sum, video) => sum + getMetaInsightValue(video.instagram_insights, 'comments') + getMetaInsightValue(video.facebook_insights, 'comments'), 0),
      };
    }, [metaData]);

    const chartData = useMemo(() => {
      return metaData.map(video => ({
        name: video.title.length > 20 ? `${video.title.substring(0, 20)}...` : video.title,
        Impressões: getMetaInsightValue(video.instagram_insights, 'impressions') + getMetaInsightValue(video.facebook_insights, 'impressions'),
        Alcance: getMetaInsightValue(video.instagram_insights, 'reach') + getMetaInsightValue(video.facebook_insights, 'reach'),
      }));
    }, [metaData]);

    if (!isInstagramConnected) {
      return (
        <div className="text-center bg-gray-800 p-8 rounded-lg border border-gray-700">
          <Instagram className="mx-auto h-12 w-12 text-gray-500" />
          <h3 className="mt-4 text-lg font-medium text-white">Instagram/Facebook não conectado</h3>
          <p className="mt-2 text-sm text-gray-400">
            Para ver as análises de performance, primeiro conecte uma conta do Instagram/Facebook a este workspace.
          </p>
          <Link href={`/niche/${nicheId}`}>
            <button className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700">
              Ir para a página de conexão
            </button>
          </Link>
        </div>
      );
    }
    
    return (
      <>
        <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard icon={ChartIcon} label="Posts Analisados" value={summaryStats.totalVideos} />
          <StatCard icon={Eye} label="Total de Impressões" value={summaryStats.totalImpressions.toLocaleString('pt-BR')} />
          <StatCard icon={ChartIcon} label="Total de Alcance" value={summaryStats.totalReach.toLocaleString('pt-BR')} />
          <StatCard icon={ThumbsUp} label="Total de Curtidas" value={summaryStats.totalLikes.toLocaleString('pt-BR')} />
        </div>
        
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Desempenho por Post</h3>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                    <Legend wrapperStyle={{ fontSize: '14px' }} />
                    <Bar dataKey="Impressões" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Alcance" fill="#818cf8" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
        
        {metaData.length > 0 ? (
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-800/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Post</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Data da Postagem</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Impressões</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Alcance</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Curtidas</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Comentários</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {metaData.map((video) => (
                  <tr key={video.id} className="hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="ml-4 max-w-xs truncate">
                          <p className="text-sm font-medium text-white">
                            {video.title || (video.instagram_post_id ? "Post do Instagram" : "Post do Facebook")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {new Date(video.scheduled_at).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{(getMetaInsightValue(video.instagram_insights, 'impressions') + getMetaInsightValue(video.facebook_insights, 'impressions')).toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{(getMetaInsightValue(video.instagram_insights, 'reach') + getMetaInsightValue(video.facebook_insights, 'reach')).toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{(getMetaInsightValue(video.instagram_insights, 'likes') + getMetaInsightValue(video.facebook_insights, 'likes')).toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{(getMetaInsightValue(video.instagram_insights, 'comments') + getMetaInsightValue(video.facebook_insights, 'comments')).toLocaleString('pt-BR')}</td>
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
              Ainda não há posts agendados ou sincronizados para analisar neste workspace.
            </p>
          </div>
        )}
      </>
    );
  };

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
          
          <div className="mb-6 border-b border-gray-700">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
              {isYouTubeConnected && (
                <button onClick={() => setActiveTab('youtube')} className={`${activeTab === 'youtube' ? 'border-teal-400 text-teal-300' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                  <Youtube size={16} /> YouTube
                </button>
              )}
              {isInstagramConnected && (
                <button onClick={() => setActiveTab('meta')} className={`${activeTab === 'meta' ? 'border-teal-400 text-teal-300' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                  <Instagram size={16} /> Instagram & Facebook
                </button>
              )}
            </nav>
          </div>

          {error && <div className="bg-red-500/20 text-red-300 p-4 rounded-md"><p className="font-bold mb-2">Ocorreu um erro:</p><p>{error}</p></div>}
          
          {!error && activeTab === 'youtube' && (
             isYouTubeConnected ? renderYouTubeContent() : renderYouTubeContent() // Renderiza a mensagem de "não conectado"
          )}
           {!error && activeTab === 'meta' && (
             isInstagramConnected ? renderMetaContent() : renderMetaContent() // Renderiza a mensagem de "não conectado"
          )}
          {
            !isYouTubeConnected && !isInstagramConnected && (
              <div className="text-center bg-gray-800 p-8 rounded-lg border border-gray-700">
                <ChartIcon className="mx-auto h-12 w-12 text-gray-500" />
                <h3 className="mt-4 text-lg font-medium text-white">Nenhuma plataforma conectada</h3>
                <p className="mt-2 text-sm text-gray-400">
                  Conecte uma conta do YouTube, Instagram ou Facebook para começar a ver análises de performance.
                </p>
                <Link href={`/niche/${nicheId}`}>
                  <button className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700">
                    Ir para a página de conexão
                  </button>
                </Link>
              </div>
            )
          }
        </div>
      </main>
    </div>
  );
}