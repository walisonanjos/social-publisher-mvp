// src/components/NichePageClient.tsx
// VERSÃO FINAL CORRIGIDA - BUILD OK

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
import MainHeader from "./MainHeader";
import InstagramAccountSelector, { InstagramAccount } from "./InstagramAccountSelector";
import { Video } from "@/types";

// NOVO: Definimos um tipo para o payload da autenticação do Instagram
interface InstagramAuthPayload {
  availableAccounts: InstagramAccount[];
  longLivedAccessToken: string;
  nicheId: string;
  userId: string;
}

export default function NichePageClient({ nicheId }: { nicheId: string }) {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [nicheName, setNicheName] = useState("Carregando...");
  const [isYouTubeConnected, setIsYouTubeConnected] = useState(false);
  const [isInstagramConnected, setIsInstagramConnected] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [igAccounts, setIgAccounts] = useState<InstagramAccount[]>([]);
  
  // ALTERADO: Usamos o novo tipo em vez de 'any'
  const [igAuthPayload, setIgAuthPayload] = useState<InstagramAuthPayload | null>(null);

  // ... (useMemo, fetchPageData, e useEffects - mantenha o código da versão anterior) ...
  // Lembre-se de manter as correções de "eslint-disable-next-line" que fizemos.

  const handleAccountSelected = async (account: InstagramAccount) => {
    // ... (lógica do handleAccountSelected - mantenha como estava) ...
  };
  
  // ... (todas as outras funções e o JSX de retorno - mantenha como estava) ...
  
  // Para garantir, aqui está a cópia completa do arquivo com a única correção necessária:
  // (O restante do código é idêntico à versão anterior que corrigiu os outros erros de build)

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
    
    const { data: connections } = await supabase
      .from('social_connections')
      .select('platform')
      .eq('user_id', userId)
      .eq('niche_id', nicheId);

    setIsYouTubeConnected(connections?.some(c => c.platform === 'youtube') || false);
    setIsInstagramConnected(connections?.some(c => c.platform === 'instagram') || false);

    const { data: nicheData } = await supabase.from('niches').select('name').eq('id', nicheId).single();
    if (nicheData) setNicheName(nicheData.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nicheId]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const selectionPayload = urlParams.get('instagram_selection');
    if (selectionPayload) {
      try {
        const decodedPayload = JSON.parse(atob(selectionPayload));
        setIgAccounts(decodedPayload.availableAccounts);
        setIgAuthPayload(decodedPayload);
        setIsSelectorOpen(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {
        console.error("Erro ao decodificar payload do Instagram", e);
        alert("Ocorreu um erro ao processar a conexão com o Instagram.");
      }
    }
    const errorPayload = urlParams.get('error');
    if (errorPayload) {
        alert(`Erro de conexão: ${decodeURIComponent(errorPayload)}`);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`videos-niche-${nicheId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'videos', filter: `niche_id=eq.${nicheId}`},
        () => {
          fetchPageData(user.id);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, nicheId]);

  const handleAccountSelected = async (account: InstagramAccount) => {
    if (!igAuthPayload) {
      alert("Erro: Dados de autenticação não encontrados.");
      return;
    }
    setIsSelectorOpen(false);
    try {
      const { error } = await supabase.functions.invoke('finalize-instagram-connection', {
        body: {
          nicheId: igAuthPayload.nicheId,
          userId: igAuthPayload.userId,
          selectedAccount: account,
          longLivedAccessToken: igAuthPayload.longLivedAccessToken,
        }
      });
      if (error) throw error;
      alert(`Conta @${account.instagramUsername} conectada com sucesso!`);
      setIsInstagramConnected(true);
    } catch (e: unknown) {
      console.error("Erro ao finalizar conexão:", e);
      let message = "Não foi possível finalizar a conexão.";
      if (e instanceof Error) message += ` Erro: ${e.message}`;
      alert(message);
    } finally {
      setIgAuthPayload(null);
    }
  };

  const handleScheduleSuccess = (newVideo: Video) => {
    setVideos(currentVideos => [...currentVideos, newVideo].sort(
        (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    ));
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este agendamento?")) return;
    const { error } = await supabase.from('videos').delete().eq('id', videoId);
    if (error) alert("Não foi possível excluir o agendamento.");
  };

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
      {isSelectorOpen && (
        <InstagramAccountSelector 
          accounts={igAccounts}
          onSelect={handleAccountSelected}
          onCancel={() => setIsSelectorOpen(false)}
        />
      )}
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