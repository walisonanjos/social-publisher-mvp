// src/components/InstagramAccountSelector.tsx

"use client";

import Image from 'next/image'; // <-- Adicionado: Importação do componente Image

// Define a estrutura de uma conta do Instagram que recebemos do backend
export interface InstagramAccount {
  pageName: string;
  instagramUserId: string;
  instagramUsername: string;
  instagramProfilePicture: string;
}

interface InstagramAccountSelectorProps {
  accounts: InstagramAccount[];
  onSelect: (account: InstagramAccount) => void;
  onCancel: () => void;
}

export default function InstagramAccountSelector({
  accounts,
  onSelect,
  onCancel,
}: InstagramAccountSelectorProps) {
  return (
    // Fundo semi-transparente que cobre a tela inteira
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      {/* O card do modal */}
      <div className="bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700 max-w-md w-full">
        <h2 className="text-xl font-bold text-white mb-4">Selecione uma Conta</h2>
        <p className="text-gray-400 mb-6">
          Encontramos múltiplas contas do Instagram. Por favor, escolha qual delas você deseja conectar a este nicho.
        </p>

        {/* Lista de contas */}
        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
          {accounts.map((account) => (
            <button
              key={account.instagramUserId}
              onClick={() => onSelect(account)}
              className="w-full flex items-center p-3 rounded-lg bg-gray-900 hover:bg-gray-700/50 border border-gray-700 transition-colors text-left"
            >
              {/* Substituído <img> por <Image> */}
              <div className="w-12 h-12 rounded-full overflow-hidden relative flex-shrink-0">
                <Image
                  src={account.instagramProfilePicture}
                  alt={account.instagramUsername}
                  className="object-cover"
                  fill // Permite que a imagem preencha o container div
                  sizes="48px" // Definindo um tamanho para a imagem
                  priority // Opcional, para carregar mais rápido se for o caso
                />
              </div>
              <div className="ml-4">
                <p className="font-semibold text-white">@{account.instagramUsername}</p>
                <p className="text-sm text-gray-400">Página do Facebook: {account.pageName}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Botão de cancelar */}
        <div className="mt-6 text-center">
            <button 
                onClick={onCancel}
                className="text-sm text-gray-400 hover:text-white"
            >
              Cancelar
            </button>
        </div>
      </div>
    </div>
  );
}