// src/components/AccountConnection.tsx
"use client";

import { useState } from "react";
import { Youtube, Instagram, Facebook, Loader2 } from "lucide-react";
import { createClient } from "../lib/supabaseClient";
import { IconBrandTiktok } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { TFunction } from "i18next";
import Link from "next/link";
import { toast } from "sonner";

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
    const [isConnecting, setIsConnecting] = useState(false);
    const supabase = createClient();

    // ✅ FUNÇÃO CRÍTICA: Inicia o fluxo OAuth de forma autenticada
    const handleYouTubeConnect = async () => {
        setIsConnecting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session || !session.access_token) {
                toast.error(t("not_authenticated_login_again"));
                return;
            }

            // 1. CHAMA A API ROUTE (POST) PASSANDO O TOKEN NO HEADER
            const authResponse = await fetch(`/api/auth/youtube?nicheId=${nicheId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`, // ✅ ENVIA O TOKEN JWT
                },
            });

            if (authResponse.ok) {
                const data = await authResponse.json();
                
                if (data.authUrl) {
                    // 2. RECEBE A URL DE REDIRECIONAMENTO E FORÇA A NAVEGAÇÃO NO CLIENTE
                    window.location.href = data.authUrl;
                } else {
                     throw new Error(t("auth_url_not_returned"));
                }
            } else {
                const errorText = await authResponse.text();
                let errorMessage = t("failed_to_connect_try_again", { platform: "YouTube" });

                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.error || errorMessage;
                } catch {
                    errorMessage = errorText;
                }
                toast.error(t("failed_to_connect_with_error", { platform: "YouTube", message: errorMessage }));
            }

        } catch (error) {
            console.error("Connection initiation failed:", error);
            toast.error(t("failed_to_connect_try_again", { platform: "YouTube" }));
        } finally {
            setIsConnecting(false);
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
                    <button
                        onClick={handleYouTubeConnect}
                        disabled={isConnecting}
                        className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-red-600/50 bg-red-600/20 hover:bg-red-600/30 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                    >
                        <Youtube size={20} />
                        <span>{isConnecting ? <Loader2 className="animate-spin" /> : t("connect_with_platform", { platform: "YouTube" })}</span>
                    </button>
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