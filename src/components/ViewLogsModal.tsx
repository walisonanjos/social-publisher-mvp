// src/components/ViewLogsModal.tsx
"use client";

import { Video } from "@/types";
import { X, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { format, Locale } from "date-fns";
import { ptBR, enUS, es, fr } from "date-fns/locale";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { TFunction } from "i18next";
import { formatInTimeZone } from 'date-fns-tz';

// Função auxiliar para formatar a data/hora do log no fuso horário do nicho
const formatLogTime = (utcDateString: string, nicheTimezone: string, locale: Locale): string => {
    const timezoneToUse = nicheTimezone && nicheTimezone !== 'UTC' ? nicheTimezone : 'UTC';

    try {
        return formatInTimeZone(
            utcDateString, 
            timezoneToUse,
            "dd/MM/yy 'às' HH:mm:ss", 
            { locale }
        );
    } catch (e) {
        return format(new Date(utcDateString), "dd/MM/yy 'às' HH:mm:ss", { locale });
    }
};

interface PostLog {
  id: number;
  created_at: string;
  platform: 'youtube' | 'instagram' | 'facebook' | 'tiktok';
  status: 'sucesso' | 'falha' | 'retentativa';
  details: string | null;
}

interface ViewLogsModalProps {
  video: Video;
  onClose: () => void;
  nicheTimezone: string; 
}

const statusStyles = {
  sucesso: "bg-green-500/20 text-green-300 border-green-500/30",
  falha: "bg-red-500/20 text-red-300 border-red-500/30",
  retentativa: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
};

const statusTranslationKey = {
    sucesso: "status_success",
    falha: "status_failed",
    retentativa: "status_retry"
};

const logDetailsTranslationKeys: { [key: string]: string } = {
  // Logs de Sucesso
  "Vídeo postado diretamente (privado). ID:": "log_posted_directly_private",
  "Reel postado com sucesso. ID do post:": "log_reel_posted_success",
  "Vídeo postado. ID no YouTube:": "log_video_posted_success_youtube_id",
  // Erros de Token
  "Token inválido. Desconectando conta automaticamente.": "log_error_token_invalid_auto_disconnect",
  "Token has been expired or revoked.": "log_error_token_expired_or_revoked",
};

const translateLogDetails = (details: string | null, t: TFunction) => {
  if (!details) return null;
  
  for (const key in logDetailsTranslationKeys) {
    if (details.startsWith(key)) { 
      const translatedKey = logDetailsTranslationKeys[key];
      const dynamicValue = details.substring(key.length).trim(); 

      return `${t(translatedKey)} ${dynamicValue}`;
    }
    if (details.startsWith('Token expired or revoked.')) {
        return t("log_error_token_expired_or_revoked");
    }
  }
  return details; 
};

export default function ViewLogsModal({ video, onClose, nicheTimezone }: ViewLogsModalProps) {
  const [logs, setLogs] = useState<PostLog[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const { i18n, t } = useTranslation();

  const getLocale = () => {
    switch (i18n.language) {
      case 'en':
        return enUS;
      case 'es':
        return es;
      case 'fr':
      case 'fr-FR': 
        return fr;
      default:
        return ptBR;
    }
  };

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('post_logs')
        .select('*')
        .eq('video_id', video.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Erro ao buscar logs:", error);
        toast.error(t("error_loading_logs"));
      } else {
        setLogs(data);
      }
      setLoading(false);
    };

    fetchLogs();
  }, [video.id, supabase, t]);
  
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700 w-full max-w-2xl h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">{t("activity_history")}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        <p className="text-gray-400 mb-6">{t("logs_for_video")}: <span className="font-medium text-gray-200">{video.title}</span></p>

        <div className="flex-grow overflow-y-auto pr-4 -mr-4">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-8 w-8 text-teal-400 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex justify-center items-center h-full text-gray-500">
              {t("no_records_found")}
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div 
                  key={log.id} 
                  className="bg-gray-900 border border-gray-700 rounded-lg p-4 shadow-sm" // ✅ CARDS DEFINIDOS
                >
                  <div className="flex justify-between items-start gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full border ${statusStyles[log.status as keyof typeof statusStyles]}`}>
                        {t(statusTranslationKey[log.status as keyof typeof statusTranslationKey])}
                      </span>
                      <span className="font-semibold text-white capitalize text-sm">
                        {log.platform}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatLogTime(log.created_at, nicheTimezone, getLocale())}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 break-words leading-relaxed">
                    {translateLogDetails(log.details, t)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}