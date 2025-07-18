// src/components/VideoGrid.tsx
// CORREÇÃO: Utiliza a interface VideoGridProps

"use client";

import { Video } from "@/types";
import { Youtube, Instagram, Facebook, ChevronUp, ChevronDown, Link as LinkIcon, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VideoGridProps {
  groupedVideos: { [key: string]: Video[] };
  onDelete: (videoId: string, cloudinaryPublicId: string | null) => void;
  sortOrder?: "asc" | "desc";
}

const statusStyles: { [key: string]: string } = {
  publicado: "bg-green-500/20 text-green-300 border-green-500/30",
  falhou: "bg-red-500/20 text-red-300 border-red-500/30",
  falha_parcial: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  agendado: "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

const PlatformStatusIcon = ({ platform, status }: { platform: 'youtube' | 'instagram' | 'facebook', status: string | null }) => {
  const icons = {
    youtube: <Youtube size={16} className="text-red-500" />,
    instagram: <Instagram size={15} className="text-pink-500" />,
    facebook: <Facebook size={15} className="text-blue-500" />,
  };

  if (!status) return null;

  return (
    <div className="flex items-center gap-1" title={`Status ${platform}: ${status}`}>
      {icons[platform]}
      {status === 'publicado' && <CheckCircle size={14} className="text-green-500" />}
      {status === 'falhou' && <XCircle size={14} className="text-red-500" />}
    </div>
  );
};

const getOverallStatus = (video: Video): 'publicado' | 'falhou' | 'falha_parcial' | 'agendado' => {
    const targets: Array<'youtube' | 'instagram' | 'facebook'> = [];
    if (video.target_youtube) targets.push('youtube');
    if (video.target_instagram) targets.push('instagram');
    if (video.target_facebook) targets.push('facebook');
    
    if (targets.length === 0) return 'agendado';

    const statuses = targets.map(p => video[`${p}_status` as keyof Video]);

    if (statuses.every(s => s === 'publicado')) return 'publicado';
    if (statuses.every(s => s === 'falhou')) return 'falhou';
    if (statuses.every(s => s === null || s === 'agendado')) return 'agendado';
    if (statuses.some(s => s === 'falhou')) return 'falha_parcial';
    return 'publicado';
}

function VideoCard({
  video,
  onDelete,
}: {
  video: Video;
  onDelete: (id: string, cloudinaryPublicId: string | null) => void;
}) {
  const overallStatus = getOverallStatus(video);
  const statusText = overallStatus === 'falha_parcial' ? 'Falha Parcial' : overallStatus.charAt(0).toUpperCase() + overallStatus.slice(1);

  return (
    <div className="bg-gray-800/50 p-4 rounded-lg flex flex-col justify-between gap-3 border border-gray-700/80 h-full">
      <div className="flex justify-between items-start">
        <span className="font-medium text-white break-all pr-2">{video.title}</span>
        <div className={`text-xs font-bold px-2 py-1 rounded-full border whitespace-nowrap ${statusStyles[overallStatus]}`}>
          {statusText}
        </div>
      </div>
      <div className="flex justify-between items-end mt-auto">
        <div className="flex items-center gap-3 text-gray-400 text-sm">
          <span>{format(new Date(video.scheduled_at), "HH:mm")}</span>
          <div className="flex items-center gap-2">
            {video.target_youtube && <PlatformStatusIcon platform="youtube" status={video.youtube_status} />}
            {video.target_instagram && <PlatformStatusIcon platform="instagram" status={video.instagram_status} />}
            {video.target_facebook && <PlatformStatusIcon platform="facebook" status={video.facebook_status} />}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {video.youtube_video_id && (video.youtube_status === 'publicado' || video.target_youtube) && (
            <Link href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white" title="Ver no YouTube">
              <LinkIcon size={16} />
            </Link>
          )}
          {(overallStatus === 'falhou' || overallStatus === 'falha_parcial') && video.post_error && (
            <div className="text-red-400 cursor-help" title={`Motivo da falha: ${video.post_error}`}>
              <AlertTriangle size={16} />
            </div>
          )}
          {overallStatus === 'agendado' && (
            <button onClick={() => onDelete(video.id, video.cloudinary_public_id)} className="text-xs text-red-500 hover:text-red-400">
              Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ALTERADO: Usando a interface VideoGridProps em vez de tipos inline
export default function VideoGrid({
  groupedVideos,
  onDelete,
  sortOrder = "desc",
}: VideoGridProps) {
  const [openGroups, setOpenGroups] = useState<{ [key: string]: boolean }>({});

  const sortedGroupKeys = Object.keys(groupedVideos).sort((a, b) => {
    if (sortOrder === "asc") {
      return new Date(a).getTime() - new Date(b).getTime();
    }
    return new Date(b).getTime() - new Date(a).getTime();
  });

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (sortedGroupKeys.length === 0) {
    const message = sortOrder === "asc" ? "Você ainda não tem nenhum agendamento futuro." : "Nenhum post no histórico.";
    return (
      <div className="text-center py-10 bg-gray-800/30 rounded-lg">
        <p className="text-gray-400">{message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedGroupKeys.map((dateKey) => {
        const date = new Date(dateKey + "T12:00:00");
        const defaultState = sortOrder === "asc" ? isToday(date) : false;
        const isGroupOpen = openGroups[dateKey] ?? defaultState;

        return (
          <div key={dateKey}>
            <button onClick={() => toggleGroup(dateKey)} className="flex justify-between items-center w-full text-left mb-3">
              <h3 className="text-lg font-semibold text-teal-400 capitalize">
                {format(date, "eeee, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </h3>
              {isGroupOpen ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
            </button>
            {isGroupOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {groupedVideos[dateKey].map((video) => (
                  <VideoCard key={video.id} video={video} onDelete={(videoId) => onDelete(videoId, video.cloudinary_public_id)} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}