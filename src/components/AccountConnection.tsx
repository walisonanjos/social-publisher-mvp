// src/components/AccountConnection.tsx

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { Youtube, Instagram, Facebook, Globe, CheckCircle, XCircle } from "lucide-react";
import { IconBrandTiktok } from "@tabler/icons-react"; // NOVO: Importe o ícone do TikTok

// Tipos
type Platform = "youtube" | "instagram" | "facebook" | "tiktok";

interface AccountConnectionProps {
  nicheId: string;
  isYouTubeConnected: boolean;
  isInstagramConnected: boolean;
  isTikTokConnected: boolean; // NOVO: Prop para o estado do TikTok
  onDisconnect: (platform: Platform) => void;
}

export default function AccountConnection({
  nicheId,
  isYouTubeConnected,
  isInstagramConnected,
  isTikTokConnected,
  onDisconnect,
}: AccountConnectionProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  // NOVO: Renderiza o ícone com base na plataforma
  const renderPlatformIcon = (platform: Platform) => {
    switch (platform) {
      case "youtube":
        return <Youtube size={24} className="text-red-500" />;
      case "instagram":
        return <Instagram size={24} className="text-pink-500" />;
      case "facebook":
        return <Facebook size={24} className="text-blue-500" />;
      case "tiktok":
        return <IconBrandTiktok size={24} className="text-gray-200" />; // ATUALIZADO
      default:
        return <Globe size={24} className="text-gray-500" />;
    }
  };

  const handleConnect = async (platform: Platform) => {
    if (loading) return;
    setLoading(true);

    try {
      let functionName = "";
      if (platform === "youtube") {
        functionName = "generate-youtube-auth-url";
      } else if (platform === "instagram") {
        functionName = "generate-facebook-auth-url";
      } else if (platform === "tiktok") {
        functionName = "generate-tiktok-auth-url"; // NOVO
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { nicheId },
      });

      if (error) {
        toast.error(`Erro ao gerar URL de autorização para ${platform}.`);
        console.error(error);
        return;
      }

      const authUrl = data.authUrl;
      window.location.href = authUrl;
    } catch (e: any) {
      toast.error(`Erro ao conectar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderConnectionCard = (
    platform: Platform,
    isConnected: boolean,
    label: string
  ) => {
    return (
      <div
        key={platform}
        className={`bg-gray-800/50 rounded-lg p-6 flex items-center justify-between border ${
          isConnected ? "border-green-500/20" : "border-gray-700"
        }`}
      >
        <div className="flex items-center gap-4">
          {renderPlatformIcon(platform)}
          <span className="text-lg font-medium">
            {label}
            {isConnected ? " Conectado" : " Não Conectado"}
          </span>
          {isConnected ? (
            <CheckCircle size={18} className="text-green-400" />
          ) : (
            <XCircle size={18} className="text-red-400" />
          )}
        </div>
        <div>
          {isConnected ? (
            <button
              onClick={() => onDisconnect(platform)}
              className="px-4 py-2 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors"
            >
              Desconectar
            </button>
          ) : (
            <button
              onClick={() => handleConnect(platform)}
              className="px-4 py-2 text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 transition-colors"
            >
              Conectar
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-gray-400">
        Conecte suas contas de redes sociais para começar a agendar.
      </p>
      {renderConnectionCard("youtube", isYouTubeConnected, "YouTube")}
      {renderConnectionCard("instagram", isInstagramConnected, "Instagram")}
      {renderConnectionCard("facebook", isInstagramConnected, "Facebook")}
      {renderConnectionCard("tiktok", isTikTokConnected, "TikTok")}
    </div>
  );
}