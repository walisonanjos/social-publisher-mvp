// src/components/AccountConnection.tsx
"use client";

import { useState } from "react";
import { Youtube, Instagram, Facebook } from "lucide-react";
import { createClient } from "../lib/supabaseClient";
import { IconBrandTiktok } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { TFunction } from "i18next";
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
          <Link
            // ✅ CORRIGIDO: Aponta para a rota de API do Next.js.
            href={`/api/auth/youtube?nicheId=${nicheId}`} 
            className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-red-600/50 bg-red-600/20 hover:bg-red-600/30 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
          >
            <Youtube size={20} />
            <span>{t("connect_with_platform", { platform: "YouTube" })}</span>
          </Link>
        )}

        {isInstagramConnected ? (
          <>
            <ConnectionStatus icon={Instagram} platformName="Instagram" onDisconnect={() => onDisconnect('instagram')} iconColorClass="text-pink-500" t={t} />
            <ConnectionStatus icon={Facebook} platformName="Facebook" onDisconnect={() => onDisconnect('instagram')} iconColorClass="text-blue-500" t={t} />
          </>
        ) : (
          <Link
            href={`/api/auth/instagram?nicheId=${nicheId}`}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-purple-600/50 bg-purple-600/20 hover:bg-purple-600/30 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
          >
            <Instagram size={20} />
            <span>{t("connect_with_platform", { platform: "Instagram / Facebook" })}</span>
          </Link>
        )}

        {isTikTokConnected ? (
          <ConnectionStatus icon={IconBrandTiktok} platformName="TikTok" onDisconnect={() => onDisconnect('tiktok')} iconColorClass="text-gray-200" t={t} />
        ) : (
          <Link
            href={`/api/auth/tiktok?nicheId=${nicheId}`}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-600/50 bg-gray-600/20 hover:bg-gray-600/30 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
          >
            <IconBrandTiktok size={20} />
            <span>{t("connect_with_platform", { platform: "TikTok" })}</span>
          </Link>
        )}
      </div>
    </div>
  );
}