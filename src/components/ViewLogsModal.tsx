// src/components/ViewLogsModal.tsx
"use client";

import { Video } from "@/types";
import { X, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner"; // <-- A CORREÇÃO ESTÁ AQUI

interface PostLog {
  id: number;
  created_at: string;
  platform: string;
  status: 'sucesso' | 'falha' | 'retentativa';
  details: string | null;
}

interface ViewLogsModalProps {
  video: Video;
  onClose: () => void;
}

const statusStyles = {
  sucesso: "bg-green-500/20 text-green-300",
  falha: "bg-red-500/20 text-red-300",
  retentativa: "bg-yellow-500/20 text-yellow-300",
};

export default function ViewLogsModal({ video, onClose }: ViewLogsModalProps) {
  const [logs, setLogs] = useState<PostLog[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

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
        toast.error("Não foi possível carregar os logs.");
      } else {
        setLogs(data);
      }
      setLoading(false);
    };

    fetchLogs();
  }, [video.id, supabase]);
  
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
          <h2 className="text-xl font-bold text-white">Histórico de Atividade</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        <p className="text-gray-400 mb-6 truncate">Logs para o vídeo: <span className="font-medium text-gray-200">{video.title}</span></p>

        <div className="flex-grow overflow-y-auto pr-4 -mr-4">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-8 w-8 text-teal-400 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex justify-center items-center h-full text-gray-500">
              Nenhum registro encontrado.
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="bg-gray-900/70 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusStyles[log.status as keyof typeof statusStyles]}`}>
                        {log.status.toUpperCase()}
                      </span>
                      <span className="font-semibold text-white capitalize">{log.platform}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {format(new Date(log.created_at), "dd/MM/yy 'às' HH:mm:ss", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 mt-2 break-words">{log.details}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}