"use client";

import { useMemo } from "react";
import Link from 'next/link';
import Image from 'next/image';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart2 as ChartIcon, Youtube, Eye, ThumbsUp, MessageSquare, CameraOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ptBR, enUS, es, fr } from "date-fns/locale";

// Tipos
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

const safeParseInt = (value: string | undefined | null): number => { if (value === null || value === undefined || value === 'N/A') return 0; const parsed = parseInt(value, 10); return isNaN(parsed) ? 0 : parsed; };

export default function YouTubeAnalyticsView({ data, nicheId }: { data: YouTubeAnalyticsVideo[], nicheId: string }) {
  const { i18n, t } = useTranslation();

  const getLocale = () => {
    switch (i18n.language) {
      case 'en':
        return enUS;
      case 'es':
        return es;
      case 'fr':
        return fr;
      default:
        return ptBR;
    }
  };

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
    views: safeParseInt(video.statistics.viewCount),
    likes: safeParseInt(video.statistics.likeCount),
  })).sort((a,b) => b.views - a.views).slice(0, 10), [data]);

  if (data.length === 0) {
    return (
      <div className="text-center bg-gray-800 p-8 rounded-lg border border-gray-700">
        <Youtube className="mx-auto h-12 w-12 text-gray-500" />
        <h3 className="mt-4 text-lg font-medium text-white">{t("no_data_to_display")}</h3>
        <p className="mt-2 text-sm text-gray-400">
          {t("no_youtube_videos_to_analyze")}
        </p>
        <Link href={`/niche/${nicheId}`}>
          <button className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700">
            {t("go_to_appointments_page")}
          </button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard icon={ChartIcon} label={t("videos_analyzed")} value={summaryStats.totalVideos} />
        <StatCard icon={Eye} label={t("total_views")} value={summaryStats.totalViews.toLocaleString(i18n.language)} />
        <StatCard icon={ThumbsUp} label={t("total_likes")} value={summaryStats.totalLikes.toLocaleString(i18n.language)} />
        <StatCard icon={MessageSquare} label={t("total_comments")} value={summaryStats.totalComments.toLocaleString(i18n.language)} />
      </div>
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-8">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' } as React.CSSProperties} />
            <Legend wrapperStyle={{ fontSize: '14px' } as React.CSSProperties} />
            <Bar dataKey="views" name={t("views")} fill="#2dd4bf" radius={[4, 4, 0, 0]} />
            <Bar dataKey="likes" name={t("likes")} fill="#818cf8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-800/50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t("video")}</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t("post_date")}</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t("views")}</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t("likes")}</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t("comments")}</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {data.map((video) => (
              <tr key={video.youtube_video_id} className="hover:bg-gray-700/50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-20 bg-gray-700 rounded-md flex items-center justify-center relative">
                      {video.thumbnail ? (
                        <Image
                            src={video.thumbnail} 
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
                      <a href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-white hover:text-teal-400 transition-colors">
                        {video.title}
                      </a>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{format(new Date(video.scheduled_at), 'P', { locale: getLocale() })}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{safeParseInt(video.statistics.viewCount).toLocaleString(i18n.language)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{safeParseInt(video.statistics.likeCount).toLocaleString(i18n.language)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{safeParseInt(video.statistics.commentCount).toLocaleString(i18n.language)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}