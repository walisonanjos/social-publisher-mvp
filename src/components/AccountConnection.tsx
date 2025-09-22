// src/components/AccountConnection.tsx
"use client";

import { useState } from "react";
import { Youtube, Instagram, Facebook } from "lucide-react";
import { createClient } from "../lib/supabaseClient";
import { IconBrandTiktok } from "@tabler/icons-react";
import { useTranslation, TFunction } from "react-i18next";
import Link from "next/link";

interface AccountConnectionProps {
  nicheId: string;
  isYouTubeConnected: boolean;
  isInstagramConnected: boolean;
  isTikTokConnected: boolean;
  onDisconnect: (platform: 'youtube' | 'instagram' | 'tiktok') => void;
}

const ConnectionStatus = ({ icon: Icon, platformName, onDisconnect, iconColorClass, t }: { icon: React.ElementType, platformName: string, onDisconnect: () => void, iconColorClass: string, t: TFunction }) => (
  <div className={`p-4 bg-green-900/50 border ${iconColorClass}/30 rounded-lg flex items-center justify-between`}>
    <div className="flex items-center gap-3">
      <Icon className={`${iconColorClass}`} size={24} />
      <span className="font-medium text-green-300">{platformName} {t("connected")}</span>
    </div>
    <button
      onClick={onDisconnect}
      className="text-xs text-red-400 hover:text-red-300 hover:underline"
    >
      {t("disconnect")}
    </button>
  </div>
);


export default function AccountConnection({
  nicheId,
  isYouTubeConnected,
  isInstagramConnected,
  isTikTokConnected,
  onDisconnect,
}: AccountConnectionProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState<null | 'youtube' | 'instagram' | 'tiktok'>(null);
  const supabase = createClient();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const handleConnect = async (platform: 'youtube' | 'instagram' | 'tiktok') => {
    setIsLoading(platform);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error(t("not_authenticated_login_again"));
      }

      let functionName: string;
      switch (platform) {
        case 'youtube':
          functionName = 'generate-youtube-auth-url';
          break;
        case 'instagram':
          functionName = 'generate-facebook-auth-url';
          break;
        case 'tiktok':
          functionName = 'generate-tiktok-auth-url';
          break;
        default:
          throw new Error(t("unknown_platform"));
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        method: 'POST',
        body: { nicheId: nicheId, userId: user.id }
      });

      if (error) throw error;
      
      if (data && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error(t("auth_url_not_returned"));
      }
    } catch (error: unknown) {
      console.error(`Erro ao gerar URL de autorização para ${platform}:`, error);
      let errorMessage = t("failed_to_connect_try_again", { platform: platform });
      if (error instanceof Error) {
        errorMessage = t("failed_to_connect_with_error", { platform: platform, message: error.message });
      }
      alert(errorMessage);
      setIsLoading(null);
    }
  };

  return (
    <div className="bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700">
      <h2 className="text-xl font-bold text-white mb-4">{t("connect_accounts")}</h2>
      <p className="text-gray-400 mb-6">
        {t("connect_social_networks")}
      </p>
      <div className="space-y-4">
        {isYouTubeConnected ? (
          <ConnectionStatus icon={Youtube} platformName="YouTube" onDisconnect={() => onDisconnect('youtube')} iconColorClass="text-red-500" t={t} />
        ) : (
          <button onClick={() => handleConnect('youtube')} disabled={isLoading !== null} className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-red-600/50 bg-red-600/20 hover:bg-red-600/30 text-white font-bold rounded-lg transition-colors disabled:opacity-50">
            <Youtube size={20} />
            <span>{isLoading === 'youtube' ? t("please_wait") : t("connect_with_platform", { platform: "YouTube" })}</span>
          </button>
        )}

        {isInstagramConnected ? (
          <>
            <ConnectionStatus icon={Instagram} platformName="Instagram" onDisconnect={() => onDisconnect('instagram')} iconColorClass="text-pink-500" t={t} />
            <ConnectionStatus icon={Facebook} platformName="Facebook" onDisconnect={() => onDisconnect('instagram')} iconColorClass="text-blue-500" t={t} />
          </>
        ) : (
          <button onClick={() => handleConnect('instagram')} disabled={isLoading !== null} className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-purple-600/50 bg-purple-600/20 hover:bg-purple-600/30 text-white font-bold rounded-lg transition-colors disabled:opacity-50">
            <Instagram size={20} />
            <span>{isLoading === 'instagram' ? t("please_wait") : t("connect_with_platform", { platform: "Instagram / Facebook" })}</span>
          </button>
        )}

        {isTikTokConnected ? (
          <ConnectionStatus icon={IconBrandTiktok} platformName="TikTok" onDisconnect={() => onDisconnect('tiktok')} iconColorClass="text-gray-200" t={t} />
        ) : (
          <button onClick={() => handleConnect('tiktok')} disabled={isLoading !== null} className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-600/50 bg-gray-600/20 hover:bg-gray-600/30 text-white font-bold rounded-lg transition-colors disabled:opacity-50">
            <IconBrandTiktok size={20} />
            <span>{isLoading === 'tiktok' ? t("please_wait") : t("connect_with_platform", { platform: "TikTok" })}</span>
          </button>
        )}
      </div>
    </div>
  );
}