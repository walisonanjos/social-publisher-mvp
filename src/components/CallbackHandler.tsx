"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner"; // Importando o toast

export default function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

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
          
          // Sucesso: Redireciona para o nicho específico
          toast.success(t("connection_success_message"));
          router.push(`/niche/${nicheId}`);
        })
        .catch((err) => {
          console.error("Callback error:", err);
          setError(err.message || t("unknown_connection_error"));
          toast.error(t("connection_failed_message"));
        });
    } else {
      setError(t("auth_code_missing_error"));
    }
  }, [searchParams, router, t]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-red-500 bg-gray-900">
        <p className="text-white text-lg">{t("connection_error_title")}</p>
        <p className="mt-2 font-mono bg-gray-700 p-2 rounded text-red-400 text-sm">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          {t("back_to_home")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 items-center justify-center min-h-screen bg-gray-900 text-white">
      <Loader2 className="h-12 w-12 text-teal-400 animate-spin" />
      <p>{t("finalizing_connection_message")}</p>
    </div>
  );
}