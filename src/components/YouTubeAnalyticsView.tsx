// src/components/YouTubeAnalyticsView.tsx
"use client";

import { useMemo } from "react";
import Link from 'next/link';
import Image from 'next/image'; // Adicionado: Importação do componente Image
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart2 as ChartIcon, Youtube, Eye, ThumbsUp, MessageSquare, CameraOff } from "lucide-react";

// Tipos
interface VideoStatistics { viewCount: string; likeCount: string; commentCount: string; }
interface YouTubeAnalyticsVideo { youtube_video_id: string; title: string; thumbnail: string; scheduled_at: string; statistics: VideoStatistics; }

// Componente StatCard
const StatCard = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | number }) => ( <div className="bg-gray-800 p-6 rounded-lg border border-gray-700"> <div className="flex items-center"> <div className="p-3 rounded-full bg-teal-500/10 text-teal-400"> <Icon className="h-6 w-6" /> </div> <div className="ml-4"> <p className="text-sm font-medium text-gray-400">{label}</p> <p className="text-2xl font-bold text-white">{value}</p> </div> </div> </div> );

const safeParseInt = (value: string | undefined | null): number => { if (value === null || value === undefined || value === 'N/A') return 0; const parsed = parseInt(value, 10); return isNaN(parsed) ? 0 : parsed; };

export default function YouTubeAnalyticsView({ data, nicheId }: { data: YouTubeAnalyticsVideo[], nicheId: string }) {
  const summaryStats = useMemo(() => {
    return {
      totalVideos: data.length,
      totalViews: data.reduce((sum, video) => sum + safeParseInt(video.statistics.viewCount), 0),
      totalLikes: data.reduce((sum, video) => sum + safeParseInt(video.statistics.likeCount), 0),
      totalComments: data.reduce((sum, video) => sum + safeParseInt(video.statistics.commentCount), 0),
    };
  }, [data]);

  const chartData = useMemo(() => data.map(video => ({
    name: video.title.length > 15 ? `${video.title.substring(0, 15)}...` : video.title,
    Visualizações: safeParseInt(video.statistics.viewCount),
    Curtidas: safeParseInt(video.statistics.likeCount),
  })).sort((a,b) => b.Visualizações - a.Visualizações).slice(0, 10), [data]);

  if (data.length === 0) {
    return (
      <div className="text-center bg-gray-800 p-8 rounded-lg border border-gray-700">
        <Youtube className="mx-auto h-12 w-12 text-gray-500" />
        <h3 className="mt-4 text-lg font-medium text-white">Nenhum dado para exibir</h3>
        <p className="mt-2 text-sm text-gray-400">
          Ainda não há vídeos postados com sucesso no YouTube para analisar neste workspace.
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
        <StatCard icon={ChartIcon} label="Vídeos Analisados" value={summaryStats.totalVideos} />
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
            <Bar dataKey="Visualizações" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Curtidas" fill="#818cf8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
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
            {data.map((video) => (
              <tr key={video.youtube_video_id} className="hover:bg-gray-700/50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-20 bg-gray-700 rounded-md flex items-center justify-center relative"> {/* Adicionado 'relative' para o Image fill */}
                      {video.thumbnail ? (
                        <Image // Substituído <img> por <Image>
                            src={video.thumbnail} 
                            alt={`Thumbnail for ${video.title}`} 
                            className="rounded-md object-cover" // ClassName para o elemento <img> interno
                            fill // Faz a imagem preencher o pai (que tem h-10 w-20)
                            sizes="80px" // Exemplo, ajuste conforme a responsividade
                            priority // Opcional: para carregar mais rápido se for importante
                        />
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
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{new Date(video.scheduled_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{safeParseInt(video.statistics.viewCount).toLocaleString('pt-BR')}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{safeParseInt(video.statistics.likeCount).toLocaleString('pt-BR')}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{safeParseInt(video.statistics.commentCount).toLocaleString('pt-BR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}