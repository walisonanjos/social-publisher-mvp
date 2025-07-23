// src/app/error/page.tsx
// Este é um Server Component por padrão
import { Suspense } from 'react';
import ErrorContent from './ErrorContent'; // Importa o Client Component criado acima

export default function ErrorPageWrapper() { // Nome do componente alterado para evitar conflito
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="p-8 bg-gray-800 rounded-lg text-center">
          <p>Carregando detalhes do erro...</p>
        </div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}