"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { User } from "@supabase/supabase-js";
import { ArrowLeft, LogOut, Loader2 } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";

interface MainHeaderProps {
  pageTitle?: string;
  backLink?: string;
}

export default function MainHeader({
  pageTitle,
  backLink,
}: MainHeaderProps) {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user: fetchedUser } } = await supabase.auth.getUser();
      setUser(fetchedUser);
      setLoading(false);
    };
    fetchUser();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <header className="bg-gray-800/80 backdrop-blur-sm p-4 border-b border-gray-700 sticky top-0 z-20">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center gap-4">
          {backLink && (
            <Link
              href={backLink}
              className="text-gray-400 hover:text-white transition-colors"
              title={t("back")}
            >
              <ArrowLeft size={20} />
            </Link>
          )}
          {pageTitle && (
            <h1 className="text-xl font-bold text-white">{pageTitle}</h1>
          )}
        </div>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          {loading ? (
            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
          ) : user ? (
            <>
              <span className="text-gray-300 hidden sm:inline">
                {t("hello_user", { user_name: user.email?.split("@")[0] })}
              </span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                <LogOut size={20} />
                <span>{t("sign_out")}</span>
              </button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}