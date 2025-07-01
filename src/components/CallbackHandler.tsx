"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";

export default function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (code && state) {
      const supabase = createClient();

      supabase.functions
        .invoke("exchange-auth-code", {
          body: { code, state },
        })
        .then((response) => {
          if (response.error) throw response.error;
          const { nicheId } = response.data;
          router.push(`/niche/${nicheId}`);
        })
        .catch((err) => {
          console.error("Callback error:", err);
          setError(err.message);
        });
    } else {
      setError("Código de autorização ou estado ausente na URL.");
    }
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-red-500">
        <p>Ocorreu um erro ao conectar sua conta:</p>
        <p className="mt-2 font-mono bg-red-100 p-2 rounded">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 px-4 py-2 bg-gray-200 rounded"
        >
          Voltar para o Início
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 items-center justify-center min-h-screen">
      <Loader2 className="h-12 w-12 text-teal-400 animate-spin" />
      <p>Finalizando conexão, por favor aguarde...</p>
    </div>
  );
}
