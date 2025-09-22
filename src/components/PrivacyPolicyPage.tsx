// src/components/PrivacyPolicyPage.tsx
"use client";

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import MainHeader from "./MainHeader";
import { Loader2 } from "lucide-react";

export default function PrivacyPolicyPage() {
  const { i18n, t } = useTranslation();
  const [markdownContent, setMarkdownContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const response = await fetch('/docs/privacy-policy-${i18n.language}.md');
        const text = await response.text();
        setMarkdownContent(text);
      } catch (error) {
        console.error("Failed to load privacy policy:", error);
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
      <MainHeader pageTitle={t("privacy_policy")} backLink="/" user={null} />
      <main className="container mx-auto p-4 md:p-8">
        <div className="prose dark:prose-invert max-w-none text-gray-300">
          <ReactMarkdown>{markdownContent}</ReactMarkdown>
        </div>
      </main>
    </div>
  );
}