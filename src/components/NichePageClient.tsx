// src/components/NichePageClient.tsx

"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabaseClient";
import { User } from "@supabase/supabase-js";
import { RefreshCw, Loader2 } from "lucide-react";
import Auth from "./Auth";
import UploadForm from "./UploadForm";
import VideoGrid from "./VideoGrid";
import Navbar from "./Navbar";
import AccountConnection from "./AccountConnection";
import { Video } from "@/types";
import MainHeader from "./MainHeader";

export default function NichePageClient({ nicheId }: { nicheId: string }) {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [nicheName, setNicheName] = useState("Carregando...");

  // ESTADOS SEPARADOS PARA CADA CONEXÃO
  const [isYouTubeConnected, setIsYouTubeConnected] = useState(false);
  const [isInstagramConnected, setIsInstagramConnected] = useState(false);

  const groupedVideos = useMemo(() => {
    const sortedVideos = [...videos].sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );
    const groups: { [key: string]: Video[] } = {};
    sortedVideos.forEach((video) => {
      const dateKey = new Date(video.scheduled_at).toISOString().split('T')[0];
      if (!groups[dateKey]) { groups[dateKey] = []; }
      groups[dateKey].push(video);
    });
    return groups;
  }, [videos]);

  const fetchPageData = useCallback(async (userId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const { data: videosData } = await supabase
      .from("videos").select<"*", Video>("*").eq("user_id", userId)
      .eq("niche_id", nicheId).gte('scheduled_at', todayISO)
      .order("scheduled_at", { ascending: true });
    setVideos(videosData || []);
    
    // BUSCA TODAS AS CONEXÕES E ATUALIZA OS ESTADOS
    const { data: connections } = await supabase
      .from('social_connections')
      .select('platform')
      .eq('user_id', userId)
      .eq('niche_id', nicheId);

    setIsYouTubeConnected(connections?.some(c => c.platform === 'youtube') || false);
    setIsInstagramConnected(connections?.some(c => c.platform === 'instagram') || false);

    const { data: nicheData } = await supabase.from('niches').select('name').eq('id', nicheId).single();
    if (nicheData) setNicheName(nicheData.name);
  }, [supabase, nicheId]);

  useEffect(() => {
    const setupPage = async () => {
      setLoading(true);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
      if (currentUser) { 
        await fetchPageData(currentUser.id); 
      }
      setLoading(false);
    };
    setupPage();
  }, [fetchPageData]);
  
  // Realtime para a lista de vídeos
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`videos-niche-${nicheId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'videos', filter: `niche_id=eq.${nicheId}`},
        (payload) => {
          console.log('Mudança nos vídeos recebida!', payload);
          fetchPageData(user.id);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, nicheId, supabase, fetchPageData]);

  const handleScheduleSuccess = (newVideo: Video) => {
    setVideos(currentVideos => [...currentVideos, newVideo]);
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este agendamento?")) return;
    const { error } = await supabase.from('videos').delete().eq('id', videoId);
    if (error) {
      alert("Não foi possível excluir o agendamento.");
    }
  };

  // FUNÇÃO DE DESCONECTAR AGORA É GENÉRICA
  const handleDisconnect = async (platform: 'youtube' | 'instagram') => {
    if (!user) return;
    const platformName = platform === 'youtube' ? 'YouTube' : 'Instagram';
    if (!window.confirm(`Tem certeza que deseja desconectar a conta do ${platformName}?`)) return;

    const { error } = await supabase
      .from('social_connections')
      .delete()
      .match({ user_id: user.id, niche_id: nicheId, platform: platform });
    
    if (error) {
      alert(`Erro ao desconectar a conta.`);
    } else {
      alert(`Conta do ${platformName} desconectada com sucesso!`);
      if (platform === 'youtube') setIsYouTubeConnected(false);
      if (platform === 'instagram') setIsInstagramConnected(false);
    }
  };

  if (loading) { return <div className="flex items-center justify-center min-h-screen bg-gray-900"><Loader2 className="h-12 w-12 text-teal-400 animate-spin" /></div>; }
  if (!user) { return <Auth />; }

  return (
    <div className="bg-gray-900 min-h-screen text-white">
      <MainHeader user={user} pageTitle={nicheName} backLink="/niches" />
      <main className="container mx-auto p-4 md:p-8">
        <Navbar nicheId={nicheId} />
        <div className="mt-8">
          <UploadForm
            nicheId={nicheId}
            onScheduleSuccess={handleScheduleSuccess}
            isYouTubeConnected={isYouTubeConnected}
            isInstagramConnected={isInstagramConnected}
          />
        </div>
        <div className="mt-8">
          <AccountConnection 
            nicheId={nicheId}
            isYouTubeConnected={isYouTubeConnected}
            isInstagramConnected={isInstagramConnected}
            onDisconnect={handleDisconnect}
          />
        </div>
        <hr className="my-8 border-gray-700" />
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-white">Meus Agendamentos</h2>
            <button onClick={() => user && fetchPageData(user.id)} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors" title="Atualizar lista">
              <RefreshCw size={14} /><span>Atualizar</span>
            </button>
        </div>
        <VideoGrid groupedVideos={groupedVideos} onDelete={handleDeleteVideo} sortOrder="asc" />
      </main>
    </div>
  );
}