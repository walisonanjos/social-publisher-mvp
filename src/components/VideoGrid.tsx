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
  PlusCircle,
  Copy,
  ScrollText,
  RefreshCw,
} from "lucide-react";
import { IconBrandTiktok } from "@tabler/icons-react";
import { useState } from "react";
import Link from "next/link";
import { format, isToday } from "date-fns";
import { ptBR, enUS, es, fr } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { TFunction } from "i18next";
import { Tooltip } from "react-tooltip";
import { formatTimeInTimezone } from "../lib/utils";

interface VideoGridProps {
  groupedVideos: { [key: string]: Video[] };
  onDelete: (videoId: number) => void;
  onEdit: (video: Video) => void;
  onDuplicate: (video: Video) => void;
  onViewLogs: (video: Video) => void;
  sortOrder?: "asc" | "desc";
  nicheTimezone: string;
}

const getPlatformError = (fullError: string | null, platform: string): string | null => {
  if (!fullError) return null;
  const errorSegment = fullError.split(' | ').find(e => e.startsWith(`Falha no ${platform}:`));
  return errorSegment ? errorSegment.replace(`Falha no ${platform}: `, '') : null;
};

const PlatformStatus = ({ platformName, status, error, t }: { platformName: 'YouTube' | 'Instagram' | 'Facebook' | 'TikTok', status: string | null, error: string | null, t: TFunction }) => {
  if (!status) return null;

  const platformIcons = {
    YouTube: <Youtube size={14} className="text-red-500" />,
    Instagram: <Instagram size={13} className="text-pink-500" />,
    Facebook: <Facebook size={14} className="text-blue-500" />,
    TikTok: <IconBrandTiktok size={14} className="text-black-400" />,
  };
  const statusIcons = { agendado: <Clock size={11} className="text-blue-400" />, publicado: <CheckCircle size={11} className="text-green-400" />, falhou: <XCircle size={11} className="text-red-400" />, };
  const tooltipId = `tooltip-${platformName}-${Math.random()}`;
  const errorMessage = getPlatformError(error, platformName);
  return (
    <div className="flex items-center gap-0.5" data-tooltip-id={tooltipId} data-tooltip-content={errorMessage} data-tooltip-place="top">
      {platformIcons[platformName]}
      {statusIcons[status as keyof typeof statusIcons]}
      {errorMessage && <Tooltip id={tooltipId} style={{ backgroundColor: "#dc2626", color: "#fff", maxWidth: "250px", fontSize: "12px", zIndex: 10 }}/>}
    </div>
  );
};

function VideoCard({
  video,
  onDelete,
  onEdit,
  onDuplicate,
  onViewLogs,
  nicheTimezone,
}: {
  video: Video;
  onDelete: (id: number) => void;
  onEdit: (video: Video) => void;
  onDuplicate: (video: Video) => void;
  onViewLogs: (video: Video) => void;
  nicheTimezone: string;
}) {
  const { t } = useTranslation();
  const isScheduled = video.youtube_status === 'agendado' || video.instagram_status === 'agendado' || video.facebook_status === 'agendado' || video.tiktok_status === 'agendado';

  return (
    <div className="bg-gray-800/50 p-4 rounded-lg flex flex-col justify-between gap-3 border border-gray-700/80 h-full">
      <div className="flex justify-between items-start">
        <span className="font-medium text-white break-all pr-2">
          {video.title}
        </span>
        <div className={`text-xs font-bold px-2 py-1 rounded-full border whitespace-nowrap ${
          video.youtube_status === 'falhou' || video.instagram_status === 'falhou' || video.facebook_status === 'falhou' || video.tiktok_status === 'falhou'
          ? "bg-red-500/20 text-red-300 border-red-500/30"
          : video.youtube_status === 'publicado' || video.instagram_status === 'publicado' || video.facebook_status === 'publicado' || video.tiktok_status === 'publicado'
          ? "bg-green-500/20 text-green-300 border-green-500/30"
          : "bg-blue-500/20 text-blue-300 border-blue-500/30"
        }`}>
          {
            video.youtube_status === 'falhou' || video.instagram_status === 'falhou' || video.facebook_status === 'falhou' || video.tiktok_status === 'falhou'
            ? t("failed")
            : video.youtube_status === 'publicado' || video.instagram_status === 'publicado' || video.facebook_status === 'publicado' || video.tiktok_status === 'publicado'
            ? t("published")
            : t("scheduled")
          }
        </div>
      </div>
      <div className="flex justify-between items-end mt-auto">
        <div className="flex items-center gap-2 text-gray-400 text-sm flex-wrap min-w-0">
          <span className="whitespace-nowrap">{formatTimeInTimezone(video.scheduled_at, nicheTimezone)}</span>
          <div className="flex items-center gap-1 border-l border-gray-700 pl-2">
            {video.target_youtube && <PlatformStatus platformName="YouTube" status={video.youtube_status} error={video.post_error} t={t} />}
            {video.target_instagram && <PlatformStatus platformName="Instagram" status={video.instagram_status} error={video.post_error} t={t} />}
            {video.target_facebook && <PlatformStatus platformName="Facebook" status={video.facebook_status} error={video.post_error} t={t} />}
            {video.target_tiktok && <PlatformStatus platformName="TikTok" status={video.tiktok_status} error={video.post_error} t={t} />}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => onViewLogs(video)} title={t("view_post_history")} className="text-gray-400 hover:text-white transition-colors">
            <ScrollText size={14} />
          </button>

          <button onClick={() => onDuplicate(video)} title={t("duplicate_post")} className="text-gray-400 hover:text-white transition-colors">
            <Copy size={14} />
          </button>

          {video.youtube_status === "publicado" && video.youtube_video_id && (
            <Link href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors" title={t("view_on_youtube")}>
              <LinkIcon size={16} />
            </Link>
          )}

          {isScheduled && (
            <div className="flex items-center gap-2 text-xs flex-shrink-0">
              <button onClick={() => onEdit(video)} className="text-blue-400 hover:text-blue-300">
                {t("edit")}
              </button>
              <button onClick={() => onDelete(video.id)} className="text-red-500 hover:text-red-400">
                {t("delete")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VideoGrid({
  groupedVideos,
  onDelete,
  onEdit,
  onDuplicate,
  onViewLogs,
  sortOrder = "desc",
  nicheTimezone,
}: VideoGridProps) {
  const { i18n, t } = useTranslation();
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

  if (sortedGroupKeys.length === 0) {
    if (sortOrder === "desc") {
      return (
        <div className="text-center py-10 bg-gray-800/30 rounded-lg">
          <p className="text-gray-400">{t("no_history")}</p>
        </div>
      );
    }

    return (
      <div className="text-center py-12 bg-gray-800/30 rounded-lg border-2 border-dashed border-gray-700/80">
        <h3 className="text-lg font-medium text-white">
          {t("all_set_for_next_hit")}
        </h3>
        <p className="text-gray-400 mt-1 mb-4">
          {t("no_future_appointments")}
        </p>
        <a
          href="#upload-form"
          className="inline-flex items-center gap-2 bg-teal-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors"
        >
          <PlusCircle size={18} />
          {t("schedule_post")}
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-white">{t("my_appointments")}</h2>
          <button onClick={() => {}} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors" title={t("update")}>
            <RefreshCw size={14} /><span>{t("update")}</span>
          </button>
        </div>

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
                {format(date, "eeee, dd 'de' MMMM 'de' yyyy", { locale: getLocale() })}
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
                  <VideoCard 
                    key={video.id} 
                    video={video} 
                    onDelete={onDelete} 
                    onEdit={onEdit} 
                    onDuplicate={onDuplicate} 
                    onViewLogs={onViewLogs}
                    nicheTimezone={nicheTimezone}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}