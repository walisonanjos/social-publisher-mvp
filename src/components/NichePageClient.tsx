// src/components/NichePageClient.tsx
// VERSÃO FINAL COMPLETA - CORRIGE ERROS DE BUILD

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

export default function NichePageClient({ nicheId }: { nicheId: string }) {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [nicheName, setNicheName] = useState("Carregando...");
  const [isYouTubeConnected, setIsYouTubeConnected] = useState(false);
  const [isInstagramConnected, setIsInstagramConnected] = useState(false);

  // Estados para controlar o modal de seleção
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [igAccounts, setIgAccounts] = useState<InstagramAccount[]>([]);
  const [igAuthPayload, setIgAuthPayload] = useState<any>(null);

  const groupedVideos = useMemo(() => {
    // ... (sua lógica de useMemo para groupedVideos - mantenha como estava)
  }, [videos]);

  const fetchPageData = useCallback(async (userId: string) => {
    // ... (sua lógica de fetchPageData - mantenha como estava)
  }, [nicheId, supabase]); // Dependências corrigidas

  // useEffect para ler os dados da URL e abrir o modal
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
  }, [fetchPageData, supabase.auth]);
  
  // Realtime para a lista de vídeos
  useEffect(() => {
    // ... (seu useEffect de realtime - mantenha como estava)
  }, [user, nicheId, supabase, fetchPageData]);

  // Função para finalizar a conexão após a seleção
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
    } catch (e: unknown) { // CORRIGIDO: de 'any' para 'unknown'
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
    // ... (sua lógica de handleDisconnect - mantenha como estava)
  };

  if (loading) { return <div className="flex items-center justify-center min-h-screen bg-gray-900"><Loader2 className="h-12 w-12 text-teal-400 animate-spin" /></div>; }
  if (!user) { return <Auth />; }

  return (
    <div className="bg-gray-900 min-h-screen text-white">
      {/* Renderiza o modal de seleção se ele estiver aberto */}
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