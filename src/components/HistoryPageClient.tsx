"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabaseClient";
import { User } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { Video } from "@/types";
import MainHeader from "./MainHeader"; // Importação adicionada
import Navbar from "./Navbar";
import VideoGrid from "./VideoGrid";
import Auth from "./Auth";
import { useRouter } from "next/navigation";
import ViewLogsModal from "./ViewLogsModal";
import { timeZones } from "../lib/timezones";
import { useTranslation } from "react-i18next";

export default function HistoryPageClient({ nicheId, nicheName }: { nicheId: string, nicheName: string }) { // nicheName adicionado aqui
  const supabase = createClient();
  const router = useRouter();
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingLogsForVideo, setViewingLogsForVideo] = useState<Video | null>(null);
  const initialTimezoneName = timeZones[0].split(') ')[1];
  const [nicheTimezone, setNicheTimezone] = useState(timeZones.find(tz => tz.endsWith(initialTimezoneName)) || timeZones[0]);

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

  useEffect(() => {
    const fetchPageData = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const todayISO = new Date().toISOString();
        const { data: videosData } = await supabase
          .from("videos")
          .select<"*", Video>("*")
          .eq("user_id", user.id)
          .eq("niche_id", nicheId)
          .lt("scheduled_at", todayISO)
          .order("scheduled_at", { ascending: false });
        setVideos(videosData || []);
        
        const { data: nicheData } = await supabase.from("niches").select("name, timezone").eq("id", nicheId).single();
        if (nicheData) {
           if (nicheData.timezone) {
            const fullTimezone = timeZones.find(tz => tz.endsWith(nicheData.timezone));
            setNicheTimezone(fullTimezone || nicheData.timezone);
          }
        }
      }
      setLoading(false);
    };
    fetchPageData();
  }, [supabase, nicheId, t]);
  
  const handleDuplicate = (video: Video) => {
    const params = new URLSearchParams({
      title: video.title,
      description: video.description || '',
    });
    router.push(`/niche/${nicheId}?${params.toString()}`);
  };

  const handleViewLogs = (video: Video) => {
    setViewingLogsForVideo(video);
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
      {viewingLogsForVideo && (
        <ViewLogsModal 
          video={viewingLogsForVideo} 
          onClose={() => setViewingLogsForVideo(null)} 
        />
      )}

      <MainHeader pageTitle={`${nicheName} - ${t("history")}`} backLink={`/niche/${nicheId}`} />

      <main className="container mx-auto p-4 md:p-8">
        <Navbar nicheId={nicheId} />

        <div className="mt-8">
          <h2 className="text-2xl font-bold tracking-tight text-white mb-6">
            {t("post_history")}
          </h2>
          <VideoGrid
            groupedVideos={groupedVideos}
            onDelete={() => {}}
            onEdit={() => {}}
            onDuplicate={handleDuplicate}
            onViewLogs={handleViewLogs}
            sortOrder="desc"
            nicheTimezone={nicheTimezone.split(') ')[1] || nicheTimezone}
          />
        </div>
      </main>
    </div>
  );
}