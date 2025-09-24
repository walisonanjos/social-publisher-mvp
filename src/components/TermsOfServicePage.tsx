// src/components/TermsOfServicePage.tsx
"use client";

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { Loader2, ArrowLeft, Home } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";
import Link from 'next/link';

export default function TermsOfServicePage() {
  const { i18n, t } = useTranslation();
  const [markdownContent, setMarkdownContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      const lang = i18n.language;
      let content = '';

      try {
        let response = await fetch(`/docs/terms-of-service-${lang}.md`);
        
        if (!response.ok) {
          console.warn(`File for language ${lang} not found, falling back to pt.`);
          response = await fetch(`/docs/terms-of-service-pt.md`);
        }

        content = await response.text();
        setMarkdownContent(content);
      } catch (error) {
        console.error("Failed to load terms of service:", error);
        setMarkdownContent(t("document_load_error"));
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [i18n.language, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <Loader2 className="h-12 w-12 text-teal-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-gray-900 min-h-screen text-white">
      <header className="bg-gray-800/80 backdrop-blur-sm p-4 border-b border-gray-700 sticky top-0 z-20">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center text-gray-400 hover:text-white transition-colors"
              title={t("home")}
            >
                <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold text-white">{t("terms_of_service")}</h1>
          </div>
          <LanguageSwitcher />
        </div>
      </header>
      <main className="container mx-auto p-4 md:p-8">
        <div className="prose dark:prose-invert max-w-none text-gray-300">
          <ReactMarkdown>{markdownContent}</ReactMarkdown>
        </div>
      </main>
    </div>
  );
}