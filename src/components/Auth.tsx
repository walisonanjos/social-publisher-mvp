"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import Link from "next/link";

export default function Auth() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const { t } = useTranslation();

  const handleAuthAction = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        alert(
          t("signup_success_check_email"),
        );
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        router.refresh();
      }
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "message" in err) {
        setError((err as { message: string }).message);
      } else {
        setError(t("unknown_error_occurred"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-sm mx-auto overflow-hidden bg-gray-800 rounded-lg shadow-md">
        <div className="px-6 py-8">
          <h2 className="text-3xl font-bold text-center text-white">
            Social Publisher
          </h2>
          <p className="mt-1 text-center text-gray-400">
            {isSignUp ? t("create_your_account") : t("access_your_workspace")}
          </p>

          <form onSubmit={handleAuthAction}>
            <div className="w-full mt-4">
              <input
                className="block w-full px-4 py-2 mt-2 text-gray-200 placeholder-gray-500 bg-gray-700 border border-gray-600 rounded-lg focus:border-teal-400 focus:ring-opacity-40 focus:outline-none focus:ring focus:ring-teal-300"
                type="email"
                placeholder={t("email_address_placeholder")}
                aria-label="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="w-full mt-4">
              <input
                className="block w-full px-4 py-2 mt-2 text-gray-200 placeholder-gray-500 bg-gray-700 border border-gray-600 rounded-lg focus:border-teal-400 focus:ring-opacity-40 focus:outline-none focus:ring focus:ring-teal-300"
                type="password"
                placeholder={t("password_placeholder")}
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

            <div className="flex items-center justify-center mt-6">
              <button
                disabled={loading}
                className="w-full px-6 py-3 text-sm font-medium tracking-wide text-white capitalize transition-colors duration-300 transform bg-teal-600 rounded-lg hover:bg-teal-700 focus:outline-none focus:ring focus:ring-teal-300 focus:ring-opacity-50 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="mx-auto animate-spin" />
                ) : isSignUp ? (
                  t("sign_up")
                ) : (
                  t("log_in_button")
                )}
              </button>
            </div>
          </form>

          <div className="flex items-center justify-center py-4 text-center bg-gray-800">
            <span className="text-sm text-gray-400">
              {isSignUp ? t("already_have_an_account") : t("no_account_question")}
            </span>
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="mx-2 text-sm font-bold text-teal-400 hover:underline"
            >
              {isSignUp ? t("log_in_link") : t("sign_up_link")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}