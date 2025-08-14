// src/components/AccountConnection.tsx



"use client";

import { useState } from "react";

import { Youtube, Instagram, Facebook, Globe } from "lucide-react";

import { createClient } from "../lib/supabaseClient";



interface AccountConnectionProps {

  nicheId: string;

  isYouTubeConnected: boolean;

  isInstagramConnected: boolean;

  isTikTokConnected: boolean; // Prop para o status da conexão TikTok

  onDisconnect: (platform: 'youtube' | 'instagram' | 'tiktok') => void; // Adicionado 'tiktok' ao tipo

}



const ConnectionStatus = ({ icon: Icon, platformName, onDisconnect, iconColorClass }: { icon: React.ElementType, platformName: string, onDisconnect: () => void, iconColorClass: string }) => (

  <div className={`p-4 bg-green-900/50 border ${iconColorClass}/30 rounded-lg flex items-center justify-between`}>

    <div className="flex items-center gap-3">

      <Icon className={`${iconColorClass}`} size={24} />

      <span className="font-medium text-green-300">{platformName} Conectado</span>

    </div>

    <button

      onClick={onDisconnect}

      className="text-xs text-red-400 hover:text-red-300 hover:underline"

    >

      Desconectar

    </button>

  </div>

);





export default function AccountConnection({

  nicheId,

  isYouTubeConnected,

  isInstagramConnected,

  isTikTokConnected, // Usado aqui

  onDisconnect,

}: AccountConnectionProps) {

  const [isLoading, setIsLoading] = useState<null | 'youtube' | 'instagram' | 'tiktok'>(null);

  const supabase = createClient();



  const handleConnect = async (platform: 'youtube' | 'instagram' | 'tiktok') => {

    setIsLoading(platform);

    try {

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {

        throw new Error("Usuário não autenticado. Por favor, faça login novamente.");

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

          throw new Error("Plataforma desconhecida.");

      }



      const { data, error } = await supabase.functions.invoke(functionName, {

        method: 'POST',

        body: { nicheId: nicheId, userId: user.id }

      });



      if (error) throw error;

     

      if (data && data.authUrl) {

        console.log("TikTok Auth URL gerada:", data.authUrl); // <-- AJUSTE ADICIONADO AQUI

        window.location.href = data.authUrl;

      } else {

        throw new Error("A função de backend não retornou uma URL de autorização.");

      }

    } catch (error: unknown) {

      console.error(`Erro ao gerar URL de autorização para ${platform}:`, error);

      let errorMessage = `Não foi possível iniciar a conexão com ${platform}. Tente novamente.`;

      if (error instanceof Error) {

        errorMessage = `Não foi possível iniciar a conexão com ${platform}. Erro: ${error.message}`;

      }

      alert(errorMessage);

      setIsLoading(null);

    }

  };



  return (

    <div className="bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700">

      <h2 className="text-xl font-bold text-white mb-4">Conectar Contas</h2>

      <p className="text-gray-400 mb-6">

        Conecte suas contas de redes sociais para começar a agendar.

      </p>

      <div className="space-y-4">

        {isYouTubeConnected ? (

          <ConnectionStatus icon={Youtube} platformName="YouTube" onDisconnect={() => onDisconnect('youtube')} iconColorClass="text-red-500" />

        ) : (

          <button onClick={() => handleConnect('youtube')} disabled={isLoading !== null} className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-red-600/50 bg-red-600/20 hover:bg-red-600/30 text-white font-bold rounded-lg transition-colors disabled:opacity-50">

            <Youtube size={20} />

            <span>{isLoading === 'youtube' ? "Aguarde..." : "Conectar com YouTube"}</span>

          </button>

        )}



        {isInstagramConnected ? (

          <>

            <ConnectionStatus icon={Instagram} platformName="Instagram" onDisconnect={() => onDisconnect('instagram')} iconColorClass="text-pink-500" />

            <ConnectionStatus icon={Facebook} platformName="Facebook" onDisconnect={() => onDisconnect('instagram')} iconColorClass="text-blue-500" />

          </>

        ) : (

          <button onClick={() => handleConnect('instagram')} disabled={isLoading !== null} className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-purple-600/50 bg-purple-600/20 hover:bg-purple-600/30 text-white font-bold rounded-lg transition-colors disabled:opacity-50">

            <Instagram size={20} />

            <span>{isLoading === 'instagram' ? "Aguarde..." : "Conectar com Instagram / Facebook"}</span>

          </button>

        )}



        {isTikTokConnected ? (

          <ConnectionStatus icon={Globe} platformName="TikTok" onDisconnect={() => onDisconnect('tiktok')} iconColorClass="text-gray-400" />

        ) : (

          <button onClick={() => handleConnect('tiktok')} disabled={isLoading !== null} className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-600/50 bg-gray-600/20 hover:bg-gray-600/30 text-white font-bold rounded-lg transition-colors disabled:opacity-50">

            <Globe size={20} />

            <span>{isLoading === 'tiktok' ? "Aguarde..." : "Conectar com TikTok"}</span>

          </button>

        )}

      </div>

    </div>

  );

}