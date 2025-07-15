// src/components/NichePageClient.tsx
// VERSÃO FINAL com fluxo de seleção de contas

"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabaseClient";
import { User } from "@supabase/supabase-js";
import { RefreshCw, Loader2 } from "lucide-react";
import UploadForm from "./UploadForm";
import VideoGrid from "./VideoGrid";
import Navbar from "./Navbar";
import AccountConnection from "./AccountConnection";
import MainHeader from "./MainHeader";
import InstagramAccountSelector, { InstagramAccount } from "./InstagramAccountSelector"; // NOVO: Importa o modal
import { Video } from "@/types"; // NOVO: Importa o tipo Video

export default function NichePageClient({ nicheId }: { nicheId: string }) {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [nicheName, setNicheName] = useState("Carregando...");
  const [isYouTubeConnected, setIsYouTubeConnected] = useState(false);
  const [isInstagramConnected, setIsInstagramConnected] = useState(false);

  // NOVO: Estados para controlar o modal de seleção
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [igAccounts, setIgAccounts] = useState<InstagramAccount[]>([]);
  const [igAuthPayload, setIgAuthPayload] = useState<any>(null);

  // ... (useMemo para groupedVideos permanece o mesmo) ...

  const fetchPageData = useCallback(async (userId: string) => {
    // ... (lógica de fetchPageData permanece a mesma) ...
  }, [supabase, nicheId]);

  // NOVO: useEffect para ler os dados da URL e abrir o modal
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const selectionPayload = urlParams.get('instagram_selection');

    if (selectionPayload) {
      try {
        const decodedPayload = JSON.parse(atob(selectionPayload));
        setIgAccounts(decodedPayload.availableAccounts);
        setIgAuthPayload(decodedPayload);
        setIsSelectorOpen(true);
        // Limpa a URL para não reabrir o modal ao recarregar a página
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
    // ... (useEffect para setupPage e realtime permanecem os mesmos) ...
  }, [fetchPageData]);
  
  // NOVO: Função para finalizar a conexão após a seleção
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
      setIsInstagramConnected(true); // Atualiza a UI

    } catch (e: any) {
      console.error("Erro ao finalizar conexão:", e);
      alert(`Não foi possível finalizar a conexão. Erro: ${e.message}`);
    } finally {
      setIgAuthPayload(null);
    }
  };

  // ... (handleScheduleSuccess, handleDeleteVideo, handleDisconnect permanecem os mesmos) ...

  if (loading) { /* ... */ }
  if (!user) { /* ... */ }

  return (
    <div className="bg-gray-900 min-h-screen text-white">
      {/* NOVO: Renderiza o modal de seleção se ele estiver aberto */}
      {isSelectorOpen && (
        <InstagramAccountSelector 
          accounts={igAccounts}
          onSelect={handleAccountSelected}
          onCancel={() => setIsSelectorOpen(false)}
        />
      )}
      
      <MainHeader user={user} pageTitle={nicheName} backLink="/niches" />
      <main className="container mx-auto p-4 md:p-8">
        {/* ... (resto do JSX permanece o mesmo) ... */}
      </main>
    </div>
  );
}