// src/components/VideoGrid.tsx
"use client";

import { Video } from "@/types";
import {
  ChevronUp,
  ChevronDown,
  Link as LinkIcon,
  Youtube,
  Instagram,
  Facebook,
  CheckCircle,
  XCircle,
  Clock,
  PlusCircle, // <-- Importar novo ícone
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip } from "react-tooltip";

interface VideoGridProps {
  groupedVideos: { [key: string]: Video[] };
  onDelete: (videoId: string) => void;
  sortOrder?: "asc" | "desc";
}

// ... (As funções auxiliares PlatformStatus e VideoCard permanecem exatamente as mesmas)
const getPlatformError = (fullError: string | null, platform: string): string | null => {
  if (!fullError) return null;
  const errorSegment = fullError.split(' | ').find(e => e.startsWith(`Falha no ${platform}:`));
  return errorSegment ? errorSegment.replace(`Falha no ${platform}: `, '') : null;
};

const PlatformStatus = ({ platformName, status, error }: { platformName: 'YouTube' | 'Instagram' | 'Facebook', status: string | null, error: string | null }) => {
  if (!status) return null;
  const platformIcons = { YouTube: <Youtube size={16} className="text-red-500" />, Instagram: <Instagram size={15} className="text-pink-500" />, Facebook: <Facebook size={16} className="text-blue-500" />, };
  const statusIcons = { agendado: <Clock size={12} className="text-blue-400" />, publicado: <CheckCircle size={12} className="text-green-400" />, falhou: <XCircle size={12} className="text-red-400" />, };
  const tooltipId = `tooltip-${platformName}-${Math.random()}`;
  const errorMessage = getPlatformError(error, platformName);
  return (
    <div className="flex items-center gap-1.5" data-tooltip-id={tooltipId} data-tooltip-content={errorMessage} data-tooltip-place="top">
      {platformIcons[platformName]}
      {statusIcons[status as keyof typeof statusIcons]}
      {errorMessage && <Tooltip id={tooltipId} style={{ backgroundColor: "#dc2626", color: "#fff", maxWidth: "250px", fontSize: "12px", zIndex: 10 }}/>}
    </div>
  );
};

function VideoCard({ video, onDelete, }: { video: Video; onDelete: (id: string) => void; }) {
  const isAnyTargetSelected = video.target_youtube || video.target_instagram || video.target_facebook;
  return (
    <div className="bg-gray-800/50 p-4 rounded-lg flex flex-col justify-between gap-3 border border-gray-700/80 h-full">
      <div className="flex justify-between items-start">
        <span className="font-medium text-white break-all pr-2">{video.title}</span>
        <div className={`text-xs font-bold px-2 py-1 rounded-full border whitespace-nowrap ${video.youtube_status === 'falhou' || video.instagram_status === 'falhou' || video.facebook_status === 'falhou' ? "bg-red-500/20 text-red-300 border-red-500/30" : video.youtube_status === 'publicado' || video.instagram_status === 'publicado' || video.facebook_status === 'publicado' ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-blue-500/20 text-blue-300 border-blue-500/30"}`}>{video.youtube_status === 'falhou' || video.instagram_status === 'falhou' || video.facebook_status === 'falhou' ? "Falhou" : video.youtube_status === 'publicado' || video.instagram_status === 'publicado' || video.facebook_status === 'publicado' ? "Publicado" : "Agendado"}</div>
      </div>
      <div className="flex justify-between items-end mt-auto">
        <div className="flex items-center gap-3 text-gray-400 text-sm">
          <span>{format(new Date(video.scheduled_at), "HH:mm")}</span>
          <div className="flex items-center gap-2 border-l border-gray-700 pl-3">
            {video.target_youtube && <PlatformStatus platformName="YouTube" status={video.youtube_status} error={video.post_error} />}
            {video.target_instagram && <PlatformStatus platformName="Instagram" status={video.instagram_status} error={video.post_error} />}
            {video.target_facebook && <PlatformStatus platformName="Facebook" status={video.facebook_status} error={video.post_error} />}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {video.youtube_status === "publicado" && video.youtube_video_id && (<Link href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors" title="Ver no YouTube"><LinkIcon size={16} /></Link>)}
          {isAnyTargetSelected && video.youtube_status === "agendado" && (<button onClick={() => onDelete(video.id)} className="text-xs text-red-500 hover:text-red-400">Excluir</button>)}
        </div>
      </div>
    </div>
  );
}


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

  // --- MUDANÇA PRINCIPAL AQUI ---
  if (sortedGroupKeys.length === 0) {
    if (sortOrder === "desc") {
      // Para a aba "Histórico", mantemos a mensagem simples.
      return (
        <div className="text-center py-10 bg-gray-800/30 rounded-lg">
          <p className="text-gray-400">Nenhum post no histórico.</p>
        </div>
      );
    }

    // Para a aba "Agendamentos", mostramos o novo componente com CTA.
    return (
      <div className="text-center py-12 bg-gray-800/30 rounded-lg border-2 border-dashed border-gray-700/80">
        <h3 className="text-lg font-medium text-white">
          Tudo pronto para o seu próximo hit
        </h3>
        <p className="text-gray-400 mt-1 mb-4">
          Você ainda não tem nenhum agendamento futuro.
        </p>
        <a
          href="#upload-form"
          className="inline-flex items-center gap-2 bg-teal-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors"
        >
          <PlusCircle size={18} />
          Agendar Post
        </a>
      </div>
    );
  }
  // --- FIM DA MUDANÇA ---

  return (
    <div className="space-y-6">
      {sortedGroupKeys.map((dateKey) => {
        const date = new Date(dateKey + "T12:00:00");
        const defaultState = sortOrder === "asc" ? isToday(date) : false;
        const isGroupOpen = openGroups[dateKey] ?? defaultState;

        return (
          <div key={dateKey}>
            <button
              onClick={() => toggleGroup(dateKey)}
              className="flex justify-between items-center w-full text-left mb-3"
            >
              <h3 className="text-lg font-semibold text-teal-400 capitalize">
                {format(date, "eeee, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </h3>
              {isGroupOpen ? (
                <ChevronUp className="text-gray-400" />
              ) : (
                <ChevronDown className="text-gray-400" />
              )}
            </button>
            {isGroupOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {groupedVideos[dateKey].map((video) => (
                  <VideoCard key={video.id} video={video} onDelete={onDelete} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}