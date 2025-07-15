// src/components/AccountConnection.tsx
// VERSÃO CORRIGIDA COM TRATAMENTO DE ERRO TYPE-SAFE

"use client";
import { useState } from "react";
import { Youtube, Instagram, CheckCircle } from "lucide-react";
import { createClient } from "../lib/supabaseClient";

interface AccountConnectionProps {
  nicheId: string;
  isYouTubeConnected: boolean;
  isInstagramConnected: boolean;
  onDisconnect: (platform: 'youtube' | 'instagram') => void;
}

const ConnectionStatus = ({ platformName, onDisconnect }: { platformName: string, onDisconnect: () => void }) => (
  <div className="p-4 bg-green-900/50 border border-green-500/30 rounded-lg flex items-center justify-between">
    <div className="flex items-center gap-3">
      <CheckCircle className="text-green-400" size={24} />
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
  onDisconnect,
}: AccountConnectionProps) {
  const [isLoading, setIsLoading] = useState<null | 'youtube' | 'instagram'>(null);
  const supabase = createClient();

  const handleConnect = async (platform: 'youtube' | 'instagram') => {
    setIsLoading(platform);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Usuário não autenticado. Por favor, faça login novamente.");
      }

      const functionName = platform === 'youtube' ? 'generate-youtube-auth-url' : 'generate-facebook-auth-url';
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        method: 'POST',
        body: {
          nicheId: nicheId,
          userId: user.id
        }
      });
      
      if (error) throw error;
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error("A função de backend não retornou uma URL de autorização.");
      }
    } catch (error: unknown) { // <-- CORREÇÃO #1: Usamos 'unknown'
      console.error(`Erro ao gerar URL de autorização para ${platform}:`, error);
      
      // CORREÇÃO #2: Verificamos o tipo do erro antes de usar a mensagem
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
        {/* Bloco para o YouTube */}
        {isYouTubeConnected ? (
          <ConnectionStatus platformName="YouTube" onDisconnect={() => onDisconnect('youtube')} />
        ) : (
          <button
            onClick={() => handleConnect('youtube')}
            disabled={isLoading !== null}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-red-600/50 bg-red-600/20 hover:bg-red-600/30 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
          >
            <Youtube size={20} />
            <span>{isLoading === 'youtube' ? "Aguarde..." : "Conectar com YouTube"}</span>
          </button>
        )}

        {/* Bloco para o Instagram/Facebook */}
        {isInstagramConnected ? (
          <ConnectionStatus platformName="Instagram" onDisconnect={() => onDisconnect('instagram')} />
        ) : (
          <button
            onClick={() => handleConnect('instagram')}
            disabled={isLoading !== null}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-purple-600/50 bg-purple-600/20 hover:bg-purple-600/30 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
          >
            <Instagram size={20} />
            <span>{isLoading === 'instagram' ? "Aguarde..." : "Conectar com Instagram / Facebook"}</span>
          </button>
        )}
      </div>
    </div>
  );
}