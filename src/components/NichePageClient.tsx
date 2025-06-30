"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { User } from "@supabase/supabase-js";
import { RefreshCw, Loader2 } from "lucide-react";
import Auth from "./Auth";
import UploadForm from "./UploadForm";
import VideoGrid from "./VideoGrid"; // CORREÇÃO: Apontando para VideoGrid
import Navbar from "./Navbar";
import AccountConnection from "./AccountConnection";
import { Video } from "@/types";
import MainHeader from "./MainHeader";

export default function NichePageClient({ nicheId }: { nicheId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [isYouTubeConnected, setIsYouTubeConnected] = useState(false);
  const [nicheName, setNicheName] = useState("Carregando...");

  const groupedVideos = useMemo(() => {
    const groups: { [key: string]: Video[] } = {};
    videos.forEach((video) => {
      const dateKey = new Date(video.scheduled_at).toISOString().split("T")[0];
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(video);
    });
    return groups;
  }, [videos]);

  const fetchPageData = async (userId: string) => {
    const { data: videosData } = await supabase
      .from("videos")
      .select<"*", Video>("*")
      .eq("user_id", userId)
      .eq("niche_id", nicheId)
      .order("scheduled_at", { ascending: true });
    setVideos(videosData || []);

    const { count } = await supabase
      .from("social_connections")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("niche_id", nicheId)
      .eq("platform", "youtube");
    setIsYouTubeConnected(!!count && count > 0);

    const { data: nicheData } = await supabase
      .from("niches")
      .select("name")
      .eq("id", nicheId)
      .single();
    if (nicheData) setNicheName(nicheData.name);
  };

  useEffect(() => {
    const setupPage = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        await fetchPageData(user.id);
      }
      setLoading(false);
    };
    setupPage();
  }, [supabase, nicheId]);

  const handleDeleteVideo = async (videoId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este agendamento?"))
      return;

    const { error } = await supabase.from("videos").delete().eq("id", videoId);
    if (error) {
      alert("Não foi possível excluir o agendamento.");
    } else {
      router.refresh();
    }
  };

  const handleDisconnectYouTube = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("social_connections")
      .delete()
      .match({ user_id: user.id, niche_id: nicheId, platform: "youtube" });
    if (error) alert("Erro ao desconectar a conta.");
    else {
      setIsYouTubeConnected(false);
      alert("Conta do YouTube desconectada com sucesso deste workspace.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <Loader2 className="h-12 w-12 text-teal-400 animate-spin" />
      </div>
    );
  }
  if (!user) {
    return <Auth />;
  }

  return (
    <div className="bg-gray-900 min-h-screen text-white">
      <MainHeader user={user} pageTitle={nicheName} backLink="/niches" />

      <main className="container mx-auto p-4 md:p-8">
        <Navbar nicheId={nicheId} />
        <div className="mt-8">
          <UploadForm nicheId={nicheId} />
        </div>
        <div className="mt-8">
          <AccountConnection
            isYouTubeConnected={isYouTubeConnected}
            onDisconnectYouTube={handleDisconnectYouTube}
            nicheId={nicheId}
          />
        </div>
        <hr className="my-8 border-gray-700" />
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Meus Agendamentos
          </h2>
          <button
            onClick={() => router.refresh()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors"
            title="Atualizar lista"
          >
            <RefreshCw size={14} />
            <span>Atualizar</span>
          </button>
        </div>
        {/* CORREÇÃO: Usando o componente VideoGrid */}
        <VideoGrid
          groupedVideos={groupedVideos}
          onDelete={handleDeleteVideo}
          sortOrder="asc"
        />
      </main>
    </div>
  );
}
