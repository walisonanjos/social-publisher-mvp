// src/components/TikTokAnalyticsView.tsx
"use client";

import { useMemo } from "react";
import Link from 'next/link';
import Image from 'next/image';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  BarChart2 as ChartIcon,
  Eye,
  ThumbsUp,
  MessageSquare, // Agora este ícone será usado
  Share2,      // Agora este ícone será usado
  CameraOff
} from "lucide-react";
import { IconBrandTiktok } from "@tabler/icons-react";

// Tipos
interface VideoStats {
  id: string;
  title: string;
  coverUrl: string;
  stats: {
    likeCount: number;
    commentCount: number;
    shareCount: number;
    viewCount: number;
  };
}
interface UserStats {
  followerCount: number;
  followingCount: number;
  likesCount: number;
  videoCount: number;
}
interface TikTokAnalytics {
  userStats: UserStats;
  videos: VideoStats[];
}

// Componente StatCard replicado para manter a estética
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

const safeParseInt = (value: string | number | undefined | null): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  return value;
};

export default function TikTokAnalyticsView({ data, nicheId }: { data: TikTokAnalytics, nicheId: string }) {

  const summaryStats = useMemo(() => {
    return {
      totalVideos: data.videos.length,
      totalViews: data.videos.reduce((sum, video) => sum + safeParseInt(video.stats.viewCount), 0),
      totalLikes: safeParseInt(data.userStats.likesCount),
      totalFollowers: safeParseInt(data.userStats.followerCount),
    };
  }, [data]);

  const chartData = useMemo(() => data.videos.map(video => ({
    name: video.title.length > 15 ? `${video.title.substring(0, 15)}...` : video.title,
    Visualizações: safeParseInt(video.stats.viewCount),
    Curtidas: safeParseInt(video.stats.likeCount),
  })).sort((a, b) => b.Visualizações - a.Visualizações).slice(0, 10), [data]);

  if (data.videos.length === 0) {
    return (
      <div className="text-center bg-gray-800 p-8 rounded-lg border border-gray-700">
        <IconBrandTiktok className="mx-auto h-12 w-12 text-gray-500" />
        <h3 className="mt-4 text-lg font-medium text-white">Nenhum dado para exibir</h3>
        <p className="mt-2 text-sm text-gray-400">
          Ainda não há vídeos postados com sucesso no TikTok para analisar neste workspace.
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
        <StatCard icon={IconBrandTiktok} label="Seguidores" value={summaryStats.totalFollowers.toLocaleString('pt-BR')} />
      </div>
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-8">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' } as React.CSSProperties} />
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
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Visualizações</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Curtidas</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Comentários</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Compartilhamentos</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {data.videos.map((video) => (
              <tr key={video.id} className="hover:bg-gray-700/50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-20 bg-gray-700 rounded-md flex items-center justify-center relative">
                      {video.coverUrl ? (
                        <Image
                          src={video.coverUrl}
                          alt={`Thumbnail for ${video.title}`}
                          className="rounded-md object-cover"
                          fill
                          sizes="80px"
                          priority
                        />
                      ) : (
                        <CameraOff className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                    <div className="ml-4 max-w-xs truncate">
                      <a href={`https://www.tiktok.com/@${data.userStats.followingCount ? 'seu-username' : ''}/video/${video.id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-white hover:text-teal-400 transition-colors">
                        {video.title || 'Vídeo sem título'}
                      </a>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 flex items-center gap-2">
                  <Eye size={16} />{safeParseInt(video.stats.viewCount).toLocaleString('pt-BR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 flex items-center gap-2">
                  <ThumbsUp size={16} />{safeParseInt(video.stats.likeCount).toLocaleString('pt-BR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 flex items-center gap-2">
                  <MessageSquare size={16} />{safeParseInt(video.stats.commentCount).toLocaleString('pt-BR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 flex items-center gap-2">
                  <Share2 size={16} />{safeParseInt(video.stats.shareCount).toLocaleString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}