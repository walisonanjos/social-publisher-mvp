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
import ViewLogsModal from "./ViewLogsModal";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import TimezoneSelector from "./TimezoneSelector";
import { timeZones } from "../lib/timezones";
import { useTranslation } from "react-i18next";

export default function NichePageClient({ nicheId, nicheName }: { nicheId: string, nicheName: string }) {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const [isYouTubeConnected, setIsYouTubeConnected] = useState(false);
  const [isInstagramConnected, setIsInstagramConnected] = useState(false);
  const [isTikTokConnected, setIsTikTokConnected] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [viewingLogsForVideo, setViewingLogsForVideo] = useState<Video | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const initialTimezoneName = timeZones[0].split(') ')[1];
  const [nicheTimezone, setNicheTimezone] = useState(timeZones.find(tz => tz.endsWith(initialTimezoneName)) || timeZones[0]);

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    
    const { data: videosData } = await supabase
      .from("videos")
      .select<"*", Video>("*")
      .eq("user_id", userId)
      .eq("niche_id", nicheId)
      .gte('scheduled_at', todayISO)
      .order("scheduled_at", { ascending: true });
      
    setVideos(videosData || []);
    
    const { data: connections } = await supabase
      .from('social_connections')
      .select('platform')
      .eq('user_id', userId)
      .eq('niche_id', nicheId);
      
    setIsYouTubeConnected(connections?.some(c => c.platform === 'youtube') || false);
    setIsInstagramConnected(connections?.some(c => c.platform === 'instagram') || false);
    setIsTikTokConnected(connections?.some(c => c.platform === 'tiktok') || false);

    const { data: nicheData } = await supabase
      .from('niches')
      .select('name, timezone')
      .eq('id', nicheId)
      .single();
    
    if (nicheData) {
      if (nicheData.timezone) {
        const fullTimezone = timeZones.find(tz => tz.endsWith(nicheData.timezone));
        setNicheTimezone(fullTimezone || nicheData.timezone);
      }
    }
  }, [nicheId, supabase]);

  useEffect(() => {
    const setupPage = async () => {
      setLoading(true);
      const { data } = await supabase.auth.getUser(); 
      setUser(data.user);
      if (data.user) {
        await fetchPageData(data.user.id);
      }
      setLoading(false);
    };
    setupPage();
  }, [fetchPageData, supabase.auth]);

  useEffect(() => {
    const duplicateTitle = searchParams.get('title');
    const duplicateDesc = searchParams.get('description');

    if (duplicateTitle !== null) {
      setFormTitle(duplicateTitle);
      setFormDescription(duplicateDesc || '');
      
      const formElement = document.getElementById('upload-form');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      toast.info(t("form_filled"));
      window.history.replaceState({}, '', `/niche/${nicheId}`);
    }
  }, [searchParams, nicheId, t]);

  useEffect(() => {
    if (!user) return;

    const videosChannel = supabase
      .channel(`videos-updates-niche-${nicheId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "videos",
          filter: `niche_id=eq.${nicheId}`,
        },
        (payload) => {
          console.log("UPDATE em tempo real recebido:", payload);
          setVideos((currentVideos) => {
            const updatedVideo = payload.new as Video;
            if (updatedVideo.youtube_status === "publicado" || updatedVideo.instagram_status === "publicado" || updatedVideo.facebook_status === "publicado" || updatedVideo.tiktok_status === "publicado" || updatedVideo.youtube_status === "falhou" || updatedVideo.instagram_status === "falhou" || updatedVideo.facebook_status === "falhou" || updatedVideo.tiktok_status === "falhou") {
              return currentVideos.filter(v => v.id !== updatedVideo.id);
            }
            return currentVideos.map(v => v.id === updatedVideo.id ? updatedVideo : v);
          });
        }
      )
      .subscribe();

    const videosDeleteChannel = supabase
      .channel(`videos-deletes-niche-${nicheId}`)
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "videos",
          filter: `niche_id=eq.${nicheId}`,
        },
        (payload) => {
          console.log("DELETE em tempo real recebido:", payload);
          setVideos((currentVideos) =>
            currentVideos.filter((video) => video.id !== payload.old.id)
          );
        }
      )
      .subscribe();

    const connectionsChannel = supabase
      .channel(`connections-niche-${nicheId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "social_connections",
          filter: `niche_id=eq.${nicheId}`,
        },
        () => {
          fetchPageData(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(videosChannel);
      supabase.removeChannel(videosDeleteChannel);
      supabase.removeChannel(connectionsChannel);
    };
  }, [user, nicheId, fetchPageData, supabase]);

  const handleScheduleSuccess = (newVideo: Video, clearFileCallback: () => void) => {
    setVideos(currentVideos => [...currentVideos, newVideo].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()));
    setFormTitle("");
    setFormDescription("");
    clearFileCallback();
  };
  
  const handleDeleteVideo = async (videoId: number) => {
    if (!window.confirm(t("delete_confirmation"))) return;
    
    setVideos(currentVideos => currentVideos.filter(v => v.id !== videoId));

    const { error } = await supabase.from('videos').delete().eq('id', videoId);
    if (error) {
      toast.error(t("delete_error"));
    } else {
      toast.success(t("delete_success"));
    }
  };
  
  const handleDisconnect = async (platform: 'youtube' | 'instagram' | 'tiktok') => {
    if (!user) return;
    const platformName = platform === 'youtube' ? 'YouTube' : (platform === 'instagram' ? 'Instagram/Facebook' : 'TikTok');
    if (!window.confirm(t("disconnect_confirmation", { platform: platformName }))) return;

    const { error } = await supabase
      .from('social_connections')
      .delete()
      .match({ user_id: user.id, niche_id: nicheId, platform: platform });
    
    if (error) {
      toast.error(t("disconnect_error"));
    } else {
      toast.success(t("disconnect_success", { platform: platformName }));
    }
  };

  const handleOpenEditModal = (video: Video) => { setEditingVideo(video); };
  const handleCloseEditModal = () => { setEditingVideo(null); };
  const handleSaveChanges = async (updatedData: { title: string; description: string; scheduled_at: string; }) => {
    if (!editingVideo) return;
    try {
      const oldVideo = editingVideo;
      setVideos(currentVideos => currentVideos.map(v => v.id === oldVideo.id ? { ...oldVideo, ...updatedData } : v));
      
      const { error } = await supabase.from('videos').update(updatedData).eq('id', editingVideo.id).select().single();
      if (error) throw error;
      
      toast.success(t("update_success_message"));
      handleCloseEditModal();
    } catch (e) {
      if (e instanceof Error) { toast.error(t("save_error", { error: e.message })); }
      else { toast.error(t("unexpected_error")); }
    }
  };

  const handleDuplicate = (video: Video) => {
    setFormTitle(video.title);
    setFormDescription(video.description || '');
    const formElement = document.getElementById('upload-form');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    toast.info(t("form_filled"));
  };

  const handleViewLogs = (video: Video) => {
    setViewingLogsForVideo(video);
  };

  if (loading) { return <div className="flex items-center justify-center min-h-screen bg-gray-900"><Loader2 className="h-12 w-12 text-teal-400 animate-spin" /></div>; }
  if (!user) { return <Auth />; }

  return (
    <div className="bg-gray-900 min-h-screen text-white">
      {editingVideo && (
        <EditVideoModal video={editingVideo} onClose={handleCloseEditModal} onSave={handleSaveChanges} />
      )}
      {viewingLogsForVideo && (
        <ViewLogsModal
          video={viewingLogsForVideo}
          onClose={() => setViewingLogsForVideo(null)}
        />
      )}
      <MainHeader user={user} pageTitle={nicheName} backLink="/niches" />
      <main className="container mx-auto p-4 md:p-8">
        <Navbar nicheId={nicheId} />
        <div className="my-8">
          <TimezoneSelector
            nicheId={nicheId}
            initialTimezone={nicheTimezone}
            onTimezoneChange={setNicheTimezone}
          />
        </div>
        <hr className="my-8 border-gray-700" />
        <div className="mt-8">
          <UploadForm
            nicheId={nicheId}
            onScheduleSuccess={handleScheduleSuccess}
            isYouTubeConnected={isYouTubeConnected}
            isInstagramConnected={isInstagramConnected}
            isTikTokConnected={isTikTokConnected}
            title={formTitle}
            setTitle={setFormTitle}
            description={formDescription}
            setDescription={setFormDescription}
            nicheTimezone={nicheTimezone.split(') ')[1] || nicheTimezone}
            existingAppointments={videos}
          />
        </div>
        <hr className="my-8 border-gray-700" />
        <div className="mt-8">
          <AccountConnection
            nicheId={nicheId}
            isYouTubeConnected={isYouTubeConnected}
            isInstagramConnected={isInstagramConnected}
            isTikTokConnected={isTikTokConnected}
            onDisconnect={handleDisconnect}
          />
        </div>
        <hr className="my-8 border-gray-700" />
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-white">{t("my_appointments")}</h2>
          <button onClick={() => user && fetchPageData(user.id)} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors" title={t("update_list")}>
            <RefreshCw size={14} /><span>{t("update")}</span>
          </button>
        </div>
        <VideoGrid
          groupedVideos={groupedVideos}
          onDelete={handleDeleteVideo}
          onEdit={handleOpenEditModal}
          onDuplicate={handleDuplicate}
          onViewLogs={handleViewLogs}
          sortOrder="asc"
          nicheTimezone={nicheTimezone.split(') ')[1] || nicheTimezone}
        />
      </main>
    </div>
  );
}