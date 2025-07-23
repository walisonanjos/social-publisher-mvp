// src/components/MetaAnalyticsView.tsx
"use client";

import { useMemo } from "react";
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart2 as ChartIcon, Eye, ThumbsUp, MessageSquare, Instagram, Facebook } from "lucide-react";

// Tipos
interface MetaInsightValue { value: number; }
interface MetaInsight { name: string; period: string; values: MetaInsightValue[]; }
interface MetaAnalyticsVideo { id: number; title: string; scheduled_at: string; instagram_post_id: string | null; facebook_post_id: string | null; instagram_insights: MetaInsight[] | null; facebook_insights: MetaInsight[] | null; }

// Componente StatCard
const StatCard = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | number }) => ( <div className="bg-gray-800 p-6 rounded-lg border border-gray-700"> <div className="flex items-center"> <div className="p-3 rounded-full bg-teal-500/10 text-teal-400"> <Icon className="h-6 w-6" /> </div> <div className="ml-4"> <p className="text-sm font-medium text-gray-400">{label}</p> <p className="text-2xl font-bold text-white">{value}</p> </div> </div> </div> );

const getMetaInsightValue = (insights: MetaInsight[] | null, metricName: string): number => {
  if (!insights) return 0;
  const metric = insights.find(insight => insight.name === metricName);
  return metric?.values?.[0]?.value ?? 0;
};

export default function MetaAnalyticsView({ data, nicheId }: { data: MetaAnalyticsVideo[], nicheId: string }) {
  const dataForDisplay = useMemo(() => data.map(video => {
    const igViews = getMetaInsightValue(video.instagram_insights, 'video_views');
    const fbViews = getMetaInsightValue(video.facebook_insights, 'total_video_views');
    const igLikes = getMetaInsightValue(video.instagram_insights, 'likes');
    const fbLikes = getMetaInsightValue(video.facebook_insights, 'post_reactions_like_total');
    const igComments = getMetaInsightValue(video.instagram_insights, 'comments');
    const fbComments = getMetaInsightValue(video.facebook_insights, 'post_comments');
    const reach = getMetaInsightValue(video.instagram_insights, 'reach') + getMetaInsightValue(video.facebook_insights, 'post_impressions');
    return { ...video, totalViews: igViews + fbViews, totalLikes: igLikes + fbLikes, totalComments: igComments + fbComments, totalReach: reach, };
  }).sort((a,b) => b.totalViews - a.totalViews), [data]);

  const summaryStats = {
    totalVideos: dataForDisplay.length,
    totalViews: dataForDisplay.reduce((sum, video) => sum + video.totalViews, 0),
    totalLikes: dataForDisplay.reduce((sum, video) => sum + video.totalLikes, 0),
    totalComments: dataForDisplay.reduce((sum, video) => sum + video.totalComments, 0),
  };
  
  const chartData = dataForDisplay.map(video => ({
    name: video.title.length > 15 ? `${video.title.substring(0, 15)}...` : video.title,
    Visualizações: video.totalViews,
    Curtidas: video.totalLikes,
  })).slice(0, 10);
  
  if (dataForDisplay.length === 0) {
    return (
      <div className="text-center bg-gray-800 p-8 rounded-lg border border-gray-700">
        <Instagram className="mx-auto h-12 w-12 text-gray-500" />
        <h3 className="mt-4 text-lg font-medium text-white">Nenhum dado para exibir</h3>
        <p className="mt-2 text-sm text-gray-400">
          Ainda não há posts do Instagram/Facebook para analisar.
        </p>
        <Link href={`/niche/${nicheId}`}>
          <button className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700">
            Ir para a página de agendamentos
          </button>
        </Link>
      </div>
    );
  }
  
  return (
      <>
      <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard icon={ChartIcon} label="Posts Analisados" value={summaryStats.totalVideos} />
        <StatCard icon={Eye} label="Total de Visualizações" value={summaryStats.totalViews.toLocaleString('pt-BR')} />
        <StatCard icon={ThumbsUp} label="Total de Curtidas" value={summaryStats.totalLikes.toLocaleString('pt-BR')} />
        <StatCard icon={MessageSquare} label="Total de Comentários" value={summaryStats.totalComments.toLocaleString('pt-BR')} />
      </div>
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-8">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
            {/* Correção do any: Adicionado as React.CSSProperties */}
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' } as React.CSSProperties} />
            {/* Correção do any: Adicionado as React.CSSProperties */}
            <Legend wrapperStyle={{ fontSize: '14px' } as React.CSSProperties} />
            <Bar dataKey="Visualizações" fill="#e1306c" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Curtidas" fill="#4a90e2" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-800/50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Vídeo</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Plataformas</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Visualizações</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Curtidas</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Comentários</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {dataForDisplay.map((video) => (
              <tr key={video.id} className="hover:bg-gray-700/50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-white max-w-xs truncate" title={video.title}>{video.title}</div>
                  <div className="text-xs text-gray-400">{new Date(video.scheduled_at).toLocaleDateString('pt-BR')}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  <div className="flex items-center gap-2">
                    {video.instagram_post_id && <Instagram size={16} className="text-pink-500"/>}
                    {video.facebook_post_id && <Facebook size={16} className="text-blue-500"/>}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{video.totalViews.toLocaleString('pt-BR')}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{video.totalLikes.toLocaleString('pt-BR')}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{video.totalComments.toLocaleString('pt-BR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}