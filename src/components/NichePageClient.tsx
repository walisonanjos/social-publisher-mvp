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
import MainHeader from "./MainHeader";
import { Video } from "@/types";
import EditVideoModal from "./EditVideoModal"; 
import { toast } from "sonner";
import { useSearchParams } from "next/navigation"; // 1. IMPORTAR useSearchParams

export default function NichePageClient({ nicheId }: { nicheId: string }) {
  const supabase = createClient();
  const searchParams = useSearchParams(); // 2. INICIALIZAR o hook
  const [user, setUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [nicheName, setNicheName] = useState("Carregando...");
  const [isYouTubeConnected, setIsYouTubeConnected] = useState(false);
  const [isInstagramConnected, setIsInstagramConnected] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const groupedVideos = useMemo(() => {
    const sortedVideos = [...videos].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    const groups: { [key: string]: Video[] } = {};
    sortedVideos.forEach((video) => {
      const dateKey = new Date(video.scheduled_at).toISOString().split('T')[0];
      if (!groups[dateKey]) { groups[dateKey] = []; }
      groups[dateKey].push(video);
    });
    return groups;
  }, [videos]);

  const fetchPageData = useCallback(async (userId: string) => {
    const today = new Date(); today.setHours(0, 0, 0, 0); const todayISO = today.toISOString();
    const { data: videosData } = await supabase.from("videos").select<"*", Video>("*").eq("user_id", userId).eq("niche_id", nicheId).gte('scheduled_at', todayISO).order("scheduled_at", { ascending: true });
    setVideos(videosData || []);
    const { data: connections } = await supabase.from('social_connections').select('platform').eq('user_id', userId).eq('niche_id', nicheId);
    setIsYouTubeConnected(connections?.some(c => c.platform === 'youtube') || false);
    setIsInstagramConnected(connections?.some(c => c.platform === 'instagram') || false);
    const { data: nicheData } = await supabase.from('niches').select('name').eq('id', nicheId).single();
    if (nicheData) setNicheName(nicheData.name);
  }, [nicheId, supabase]);
  
  useEffect(() => {
    const setupPage = async () => { setLoading(true); const { data: { user: currentUser } } = await supabase.auth.getUser(); setUser(currentUser); if (currentUser) { await fetchPageData(currentUser.id); } setLoading(false); };
    setupPage();
  }, [fetchPageData, supabase.auth]);
 
  // 3. NOVO useEffect PARA LER DADOS DA URL PARA DUPLICAÇÃO
  useEffect(() => {
    const duplicateTitle = searchParams.get('title');
    const duplicateDesc = searchParams.get('description');

    // Se encontramos um título na URL, preenchemos o formulário
    if (duplicateTitle !== null) {
      setFormTitle(duplicateTitle);
      setFormDescription(duplicateDesc || '');
      
      const formElement = document.getElementById('upload-form');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      toast.info("Formulário preenchido. Selecione um novo vídeo e data.");

      // Limpa os parâmetros da URL para não preencher novamente no reload
      window.history.replaceState({}, '', `/niche/${nicheId}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, nicheId]);


  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`videos-niche-${nicheId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'videos', filter: `niche_id=eq.${nicheId}`}, () => { if(user) fetchPageData(user.id); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, nicheId, fetchPageData, supabase]);

  const handleScheduleSuccess = (newVideo: Video, clearFileCallback: () => void) => {
    setVideos(currentVideos => [...currentVideos, newVideo].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()));
    setFormTitle("");
    setFormDescription("");
    clearFileCallback();
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este agendamento?")) return;
    const { error } = await supabase.from('videos').delete().eq('id', videoId);
    if (error) { toast.error("Não foi possível excluir o agendamento."); } 
    else { toast.success("Agendamento excluído com sucesso."); }
  };

  const handleDisconnect = async (platform: 'youtube' | 'instagram') => { /* ... */ };
  const handleOpenEditModal = (video: Video) => { setEditingVideo(video); };
  const handleCloseEditModal = () => { setEditingVideo(null); };
  const handleSaveChanges = async (updatedData: { title: string; description: string; scheduled_at: string; }) => {
    if (!editingVideo) return;
    try {
      const { data, error } = await supabase.from('videos').update(updatedData).eq('id', editingVideo.id).select().single();
      if (error) throw error;
      setVideos(currentVideos => currentVideos.map(v => v.id === data.id ? data : v));
      toast.success("Agendamento atualizado com sucesso!");
      handleCloseEditModal();
    } catch (e) {
      if (e instanceof Error) { toast.error(`Erro ao salvar: ${e.message}`); } 
      else { toast.error("Ocorreu um erro inesperado ao salvar as alterações."); }
    }
  };

  const handleDuplicate = (video: Video) => {
    setFormTitle(video.title);
    setFormDescription(video.description || '');
    const formElement = document.getElementById('upload-form');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    toast.info("Formulário preenchido. Selecione um novo vídeo e data.");
  };

  if (loading) { return <div className="flex items-center justify-center min-h-screen bg-gray-900"><Loader2 className="h-12 w-12 text-teal-400 animate-spin" /></div>; }
  if (!user) { return <Auth />; }

  return (
    <div className="bg-gray-900 min-h-screen text-white">
      {editingVideo && (
        <EditVideoModal video={editingVideo} onClose={handleCloseEditModal} onSave={handleSaveChanges} />
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
            title={formTitle}
            setTitle={setFormTitle}
            description={formDescription}
            setDescription={setFormDescription}
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
        <VideoGrid 
          groupedVideos={groupedVideos} 
          onDelete={handleDeleteVideo} 
          onEdit={handleOpenEditModal}
          onDuplicate={handleDuplicate}
          sortOrder="asc" 
        />
        <div className="mt-12">
            <h2 className="text-2xl font-bold tracking-tight text-white mb-6">Histórico de Posts</h2>
            {/* Adicionando o grid de histórico aqui */}
            {/* Precisamos de um novo componente ou lógica para buscar e exibir os vídeos do histórico */}
        </div>
      </main>
    </div>
  );
}