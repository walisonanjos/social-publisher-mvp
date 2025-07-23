// src/app/error/page.tsx
"use client"; // Necessário para usar hooks como useSearchParams

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function ErrorPage() {
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState("Ocorreu um erro inesperado.");
  const [errorDetails, setErrorDetails] = useState("Por favor, tente novamente mais tarde.");

  useEffect(() => {
    const message = searchParams.get('message');
    const details = searchParams.get('details');

    if (message) {
      setErrorMessage(decodeURIComponent(message.replace(/_/g, ' '))); // Substitui _ por espaço para legibilidade
    }
    if (details) {
      setErrorDetails(decodeURIComponent(details.replace(/_/g, ' '))); // Substitui _ por espaço para legibilidade
    }
  }, [searchParams]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700 text-center">
        <h1 className="text-3xl font-bold text-red-400 mb-4">Erro!</h1>
        <p className="text-lg text-gray-300 mb-2">{errorMessage}</p>
        <p className="text-sm text-gray-400 mb-6">{errorDetails}</p>
        <Link href="/" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">
          Voltar para a Página Inicial
        </Link>
      </div>
    </div>
  );
}